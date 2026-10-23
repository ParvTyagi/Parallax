import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Parallax Contracts on Ethereum", function () {
  let escrow: any;
  let taskManager: any;
  let owner: Signer;
  let orchestrator: Signer;
  let customer: Signer;
  let worker1: Signer;
  let worker2: Signer;
  let treasury: Signer;

  const reward = ethers.parseEther("0.1"); // 0.1 ETH
  const bond = ethers.parseEther("0.001"); // 0.001 ETH worker bond
  const description = "Test Ethereum Task";

  beforeEach(async function () {
    [owner, orchestrator, customer, worker1, worker2, treasury] = await ethers.getSigners();

    const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
    taskManager = await TaskManager.deploy(
      await orchestrator.getAddress(),
      await treasury.getAddress(),
      await owner.getAddress()
    );
    await taskManager.waitForDeployment();

    const escrowAddress = await taskManager.escrow();
    const Escrow = await ethers.getContractFactory("ParallaxEscrow");
    escrow = Escrow.attach(escrowAddress);
  });

  describe("Deployment & Initialization", function () {
    it("should deploy escrow automatically and set taskManager correctly", async function () {
      expect(await escrow.taskManager()).to.equal(await taskManager.getAddress());
      expect(await taskManager.orchestrator()).to.equal(await orchestrator.getAddress());
      expect(await taskManager.platformTreasury()).to.equal(await treasury.getAddress());
      expect(await taskManager.admin()).to.equal(await owner.getAddress());
    });
  });

  describe("Task Creation", function () {
    it("should allow customer to create a task and fund escrow", async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 },
        { rangeLabel: "101-200", description: "Second batch", reward: reward, leaseDuration: 3600 }
      ];

      const totalReward = reward * 2n;

      await expect(
        taskManager.connect(customer).createTask(description, subtaskInputs, { value: totalReward })
      ).to.emit(taskManager, "TaskCreated");

      const escrowBalance = await ethers.provider.getBalance(await escrow.getAddress());
      expect(escrowBalance).to.equal(totalReward);

      const subtasks = await taskManager.getTaskSubtasks(
        ethers.keccak256(
          ethers.solidityPacked(
            ["string", "uint256", "address"],
            [description, await ethers.provider.getBlock("latest").then((b) => b!.timestamp), await customer.getAddress()]
          )
        )
      );
      expect(subtasks.length).to.equal(2);
    });
  });

  describe("Subtask Claiming & Submission", function () {
    let taskId: string;
    let subtaskId1: string;

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];

      const tx = await taskManager.connect(customer).createTask(description, subtaskInputs, { value: reward });
      const receipt = await tx.wait();

      const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TaskCreated");
      taskId = event.args[0];

      const subtaskEvent = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "SubtaskCreated");
      subtaskId1 = subtaskEvent.args[1];
    });

    it("should reject a creator claiming their own subtask without changing state or funds", async function () {
      const escrowBalance = await ethers.provider.getBalance(await escrow.getAddress());
      await expect(
        taskManager.connect(customer).claimSubtask(taskId, subtaskId1, { value: bond })
      ).to.be.revertedWith("Task creator cannot claim own subtask");

      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.worker).to.equal(ethers.ZeroAddress);
      expect(subtask.state).to.equal(0); // SubtaskState.CREATED
      expect(subtask.claimTime).to.equal(0);
      expect(subtask.bondAmount).to.equal(0);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(escrowBalance);

      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: bond }))
        .to.emit(taskManager, "SubtaskClaimed")
        .withArgs(taskId, subtaskId1, await worker1.getAddress(), bond);
    });

    it("should require bond to claim subtask", async function () {
      await expect(
        taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient worker bond");
    });

    it("should allow worker to claim subtask with bond", async function () {
      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: bond }))
        .to.emit(taskManager, "SubtaskClaimed")
        .withArgs(taskId, subtaskId1, await worker1.getAddress(), bond);

      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.worker).to.equal(await worker1.getAddress());
      expect(subtask.bondAmount).to.equal(bond);
    });

    it("should allow worker to submit proof hash", async function () {
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: bond });
      const submissionHash = ethers.keccak256(ethers.toUtf8Bytes("submission content"));

      await expect(taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionHash))
        .to.emit(taskManager, "SubmissionProofRecorded")
        .withArgs(taskId, subtaskId1, submissionHash);

      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.state).to.equal(2); // SubtaskState.SUBMITTED
    });
  });

  describe("Verification & Immediate Payout", function () {
    let taskId: string;
    let subtaskId1: string;
    const submissionHash = ethers.keccak256(ethers.toUtf8Bytes("submission content"));

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];

      const tx = await taskManager.connect(customer).createTask(description, subtaskInputs, { value: reward });
      const receipt = await tx.wait();

      taskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TaskCreated").args[0];
      subtaskId1 = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "SubtaskCreated").args[1];

      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: bond });
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionHash);
    });

    it("only orchestrator can verify", async function () {
      await expect(
        taskManager.connect(worker1).verifySubtask(taskId, subtaskId1, true, 95)
      ).to.be.revertedWith("Only orchestrator can call this");
    });

    it("immediately pays the reward and bond on successful verification", async function () {
      const workerBefore = await ethers.provider.getBalance(await worker1.getAddress());
      const treasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 95))
        .to.emit(taskManager, "SubtaskVerified").withArgs(taskId, subtaskId1, true, 95, 0)
        .and.to.emit(taskManager, "PayoutReleased").withArgs(taskId, subtaskId1, await worker1.getAddress());
      expect(await ethers.provider.getBalance(await worker1.getAddress()) - workerBefore).to.equal(reward * 95n / 100n + bond);
      expect(await ethers.provider.getBalance(await treasury.getAddress()) - treasuryBefore).to.equal(reward * 5n / 100n);
      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.state).to.equal(5); // VERIFIED
      expect(subtask.score).to.equal(95);
      expect(subtask.disputeDeadline).to.equal(0);
      expect(subtask.bondAmount).to.equal(0);
      expect(await escrow.workerBonds(await worker1.getAddress())).to.equal(0);
      expect(await escrow.escrowBalances(taskId)).to.equal(0);
      expect(await escrow.subtaskPaid(subtaskId1)).to.equal(true);
    });

    it("cannot release an unverified payout", async function () {
      await expect(taskManager.releasePayout(taskId, subtaskId1)).to.be.revertedWith("Subtask is not pending release");
    });

    it("cannot pay twice or dispute a completed payout", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 95);
      await expect(taskManager.releasePayout(taskId, subtaskId1)).to.be.revertedWith("Subtask is not pending release");
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 95)).to.be.revertedWith("Subtask must be in SUBMITTED state");
      await expect(taskManager.connect(customer).disputeTask(taskId, subtaskId1)).to.be.revertedWith("Only failed verification can be disputed");
      await expect(taskManager.connect(owner).resolveDispute(taskId, subtaskId1, false)).to.be.revertedWith("Subtask is not under dispute");
    });


    it("holds failed work and its bond for a worker appeal", async function () {
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 30))
        .to.emit(taskManager, "SubtaskVerificationFailed").withArgs(taskId, subtaskId1, 30);
      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.state).to.equal(8);
      expect(subtask.worker).to.equal(await worker1.getAddress());
      expect(subtask.submissionHash).to.equal(submissionHash);
      expect(subtask.bondAmount).to.equal(bond);
      expect(await escrow.workerBonds(await worker1.getAddress())).to.equal(bond);
      expect(await escrow.escrowBalances(taskId)).to.equal(reward);
      expect(await escrow.subtaskPaid(subtaskId1)).to.equal(false);
      await expect(taskManager.connect(worker2).claimSubtask(taskId, subtaskId1, { value: bond })).to.be.revertedWith("Subtask not available to claim");
      await expect(taskManager.connect(customer).cancelTask(taskId)).to.be.revertedWith("No unallocated funds remaining to refund");
    });
    it("only the submitting worker can appeal a failed verdict, once", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 30);
      for (const caller of [customer, worker2]) {
        await expect(taskManager.connect(caller).disputeTask(taskId, subtaskId1)).to.be.revertedWith("Only the submitting worker can dispute");
      }
      await expect(taskManager.connect(worker1).disputeTask(taskId, subtaskId1)).to.emit(taskManager, "DisputeRaised").withArgs(taskId, subtaskId1, await worker1.getAddress());
      expect((await taskManager.subtasks(subtaskId1)).state).to.equal(4);
      await expect(taskManager.connect(worker1).disputeTask(taskId, subtaskId1)).to.be.revertedWith("Only failed verification can be disputed");
    });
    it("only admin can resolve and an approved appeal pays immediately", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 30);
      await taskManager.connect(worker1).disputeTask(taskId, subtaskId1);
      await expect(taskManager.connect(worker1).resolveDispute(taskId, subtaskId1, true)).to.be.revertedWith("Only admin can call this");
      const before = await ethers.provider.getBalance(await worker1.getAddress());
      await expect(taskManager.connect(owner).resolveDispute(taskId, subtaskId1, true)).to.emit(taskManager, "PayoutReleased").and.to.emit(taskManager, "DisputeResolved").withArgs(taskId, subtaskId1, true);
      expect(await ethers.provider.getBalance(await worker1.getAddress()) - before).to.equal(reward * 95n / 100n + bond);
      expect((await taskManager.subtasks(subtaskId1)).state).to.equal(5);
      expect(await escrow.workerBonds(await worker1.getAddress())).to.equal(0);
      expect(await escrow.escrowBalances(taskId)).to.equal(0);
      await expect(taskManager.connect(owner).resolveDispute(taskId, subtaskId1, true)).to.be.revertedWith("Subtask is not under dispute");
    });
    it("upholding rejection refunds the creator and slashes the bond only after admin resolution", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 30);
      expect(await escrow.totalProtocolRevenue()).to.equal(0);
      await taskManager.connect(worker1).disputeTask(taskId, subtaskId1);
      const before = await ethers.provider.getBalance(await customer.getAddress());
      await taskManager.connect(owner).resolveDispute(taskId, subtaskId1, false);
      expect(await ethers.provider.getBalance(await customer.getAddress()) - before).to.equal(reward);
      expect((await taskManager.subtasks(subtaskId1)).state).to.equal(6);
      expect(await escrow.workerBonds(await worker1.getAddress())).to.equal(0);
      expect(await escrow.totalProtocolRevenue()).to.equal(bond);
      expect(await escrow.escrowBalances(taskId)).to.equal(0);
      await expect(taskManager.connect(worker1).disputeTask(taskId, subtaskId1)).to.be.revertedWith("Only failed verification can be disputed");
    });
    it("does not pay below threshold even when passed=true", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 69);
      expect((await taskManager.subtasks(subtaskId1)).state).to.equal(8);
      expect(await escrow.subtaskPaid(subtaskId1)).to.equal(false);
    });
    it("pays at the existing threshold of 70", async function () {
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 70);
      expect((await taskManager.subtasks(subtaskId1)).state).to.equal(5);
      expect(await escrow.subtaskPaid(subtaskId1)).to.equal(true);
    });
    it("rejects invalid scores", async function () {
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 101)).to.be.revertedWith("Score must be between 0 and 100");
    });

  });

  describe("Task Cancellation & Escrow Protection", function () {
    let taskId: string;
    let subtaskId1: string;
    let subtaskId2: string;

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "Batch 1", description: "Subtask 1", reward: reward, leaseDuration: 3600 },
        { rangeLabel: "Batch 2", description: "Subtask 2", reward: reward, leaseDuration: 3600 }
      ];

      const tx = await taskManager.connect(customer).createTask(description, subtaskInputs, { value: reward * 2n });
      const receipt = await tx.wait();

      taskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TaskCreated").args[0];
      const subtaskEvents = receipt.logs.filter((log: any) => log.fragment && log.fragment.name === "SubtaskCreated");
      subtaskId1 = subtaskEvents[0].args[1];
      subtaskId2 = subtaskEvents[1].args[1];
    });

    it("allows customer to cancel when all subtasks are CREATED and refunds full escrow", async function () {
      const custBefore = await ethers.provider.getBalance(await customer.getAddress());
      const tx = await taskManager.connect(customer).cancelTask(taskId);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;

      const custAfter = await ethers.provider.getBalance(await customer.getAddress());
      expect(custAfter + gasSpent - custBefore).to.equal(reward * 2n);

      const task = await taskManager.tasks(taskId);
      expect(task.cancelled).to.be.true;

      const st1 = await taskManager.subtasks(subtaskId1);
      const st2 = await taskManager.subtasks(subtaskId2);
      expect(st1.state).to.equal(7); // SubtaskState.CANCELLED
      expect(st2.state).to.equal(7);
    });

    it("only refunds unallocated subtasks when one subtask is CLAIMED, protecting the worker's reward", async function () {
      // Worker 1 claims subtask 1
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1, { value: bond });

      // Customer attempts to cancel task
      const custBefore = await ethers.provider.getBalance(await customer.getAddress());
      const tx = await taskManager.connect(customer).cancelTask(taskId);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;

      const custAfter = await ethers.provider.getBalance(await customer.getAddress());
      // Only subtask 2's reward is refunded!
      expect(custAfter + gasSpent - custBefore).to.equal(reward);

      // Task is not fully cancelled because subtask 1 is still in progress
      const task = await taskManager.tasks(taskId);
      expect(task.cancelled).to.be.false;

      // Subtask 2 is CANCELLED, Subtask 1 remains CLAIMED
      const st1 = await taskManager.subtasks(subtaskId1);
      const st2 = await taskManager.subtasks(subtaskId2);
      expect(st1.state).to.equal(1); // CLAIMED
      expect(st2.state).to.equal(7); // CANCELLED

      // Worker 1 submits work and orchestrator verifies
      const submissionHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionHash);
      const workerBefore = await ethers.provider.getBalance(await worker1.getAddress());
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 90);
      const workerAfter = await ethers.provider.getBalance(await worker1.getAddress());

      const expectedPayout = (reward * 95n) / 100n + bond;
      expect(workerAfter - workerBefore).to.equal(expectedPayout);
    });

    it("prevents non-creators from cancelling", async function () {
      await expect(taskManager.connect(worker1).cancelTask(taskId)).to.be.revertedWith(
        "Only creator can cancel task"
      );
    });

    it("reverts when no unallocated funds remain to refund", async function () {
      await taskManager.connect(customer).cancelTask(taskId);
      await expect(taskManager.connect(customer).cancelTask(taskId)).to.be.revertedWith(
        "Task already cancelled"
      );
    });
  });
});

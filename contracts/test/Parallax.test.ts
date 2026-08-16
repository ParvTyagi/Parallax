import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Parallax Contracts", function () {
  let escrow: any;
  let taskManager: any;
  let owner: Signer;
  let orchestrator: Signer;
  let customer: Signer;
  let worker1: Signer;
  let worker2: Signer;

  const taskId = ethers.encodeBytes32String("task-1");
  const subtaskId1 = ethers.encodeBytes32String("subtask-1");
  const subtaskId2 = ethers.encodeBytes32String("subtask-2");
  const budget = ethers.parseEther("100");
  const reward = ethers.parseEther("20");

  beforeEach(async function () {
    [owner, orchestrator, customer, worker1, worker2] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("ParallaxEscrow");
    escrow = await Escrow.deploy();

    const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
    taskManager = await TaskManager.deploy(await escrow.getAddress(), await orchestrator.getAddress());

    await escrow.setTaskManager(await taskManager.getAddress());
  });

  describe("Task & Escrow", function () {
    it("should allow customer to create a task and fund escrow", async function () {
      await expect(taskManager.connect(customer).createTask(taskId, budget, { value: budget }))
        .to.emit(taskManager, "TaskCreated")
        .withArgs(taskId, await customer.getAddress(), budget);

      expect(await escrow.escrowBalances(taskId)).to.equal(budget);
    });

    it("unauthorized account cannot release funds", async function () {
      await taskManager.connect(customer).createTask(taskId, budget, { value: budget });
      await expect(
        escrow.connect(worker1).releasePayment(taskId, subtaskId1, await worker1.getAddress(), reward)
      ).to.be.revertedWith("Only TaskManager can call this");
    });
  });

  describe("Subtasks & Claiming", function () {
    beforeEach(async function () {
      await taskManager.connect(customer).createTask(taskId, budget, { value: budget });
      await taskManager.connect(customer).createSubtask(taskId, subtaskId1, reward);
    });

    it("should allow worker to claim subtask", async function () {
      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1))
        .to.emit(taskManager, "SubtaskClaimed")
        .withArgs(taskId, subtaskId1, await worker1.getAddress());
      
      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.worker).to.equal(await worker1.getAddress());
    });

    it("cannot claim an already claimed subtask", async function () {
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
      await expect(taskManager.connect(worker2).claimSubtask(taskId, subtaskId1))
        .to.be.revertedWith("Subtask not available to claim");
    });
  });

  describe("Submissions", function () {
    const submissionHash = ethers.encodeBytes32String("hash-1");

    beforeEach(async function () {
      await taskManager.connect(customer).createTask(taskId, budget, { value: budget });
      await taskManager.connect(customer).createSubtask(taskId, subtaskId1, reward);
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
    });

    it("should allow claiming worker to submit", async function () {
      await expect(taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionHash))
        .to.emit(taskManager, "SubmissionProofRecorded")
        .withArgs(taskId, subtaskId1, submissionHash);
    });

    it("only claiming worker can submit", async function () {
      await expect(taskManager.connect(worker2).recordSubmissionProof(taskId, subtaskId1, submissionHash))
        .to.be.revertedWith("Only the claiming worker can submit");
    });
  });

  describe("Verification & Payout", function () {
    const submissionHash = ethers.encodeBytes32String("hash-1");

    beforeEach(async function () {
      await taskManager.connect(customer).createTask(taskId, budget, { value: budget });
      await taskManager.connect(customer).createSubtask(taskId, subtaskId1, reward);
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionHash);
    });

    it("only verifier (orchestrator) can verify", async function () {
      await expect(taskManager.connect(worker1).verifySubtask(taskId, subtaskId1, true, 100))
        .to.be.revertedWith("Only orchestrator can call this");
    });

    it("successful verification pays exactly once", async function () {
      const initialBalance = await ethers.provider.getBalance(await worker1.getAddress());

      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 100))
        .to.emit(taskManager, "SubtaskVerified")
        .withArgs(taskId, subtaskId1, true, 100)
        .and.to.emit(escrow, "PaymentReleased")
        .withArgs(taskId, subtaskId1, await worker1.getAddress(), reward);

      const finalBalance = await ethers.provider.getBalance(await worker1.getAddress());
      expect(finalBalance - initialBalance).to.equal(reward);

      // Verify cannot pay twice (will revert in Escrow)
      // We simulate trying to verify again, but the state is no longer SUBMITTED
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 100))
        .to.be.revertedWith("Subtask must be in SUBMITTED state");
    });

    it("rejected verification pays nothing", async function () {
      const initialBalance = await ethers.provider.getBalance(await worker1.getAddress());

      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 50))
        .to.emit(taskManager, "SubtaskVerified")
        .withArgs(taskId, subtaskId1, false, 50);

      const finalBalance = await ethers.provider.getBalance(await worker1.getAddress());
      expect(finalBalance).to.equal(initialBalance); // No reward

      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.state).to.equal(4); // REJECTED state
    });

    it("cannot release more than escrow", async function () {
      // Create a subtask with reward higher than total escrow
      const bigReward = ethers.parseEther("200");
      await taskManager.connect(customer).createSubtask(taskId, subtaskId2, bigReward);
      await taskManager.connect(worker2).claimSubtask(taskId, subtaskId2);
      await taskManager.connect(worker2).recordSubmissionProof(taskId, subtaskId2, submissionHash);

      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId2, true, 100))
        .to.be.revertedWith("Insufficient escrow balance");
    });
  });
});

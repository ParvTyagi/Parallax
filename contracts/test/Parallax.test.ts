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

  const budget = ethers.parseEther("100");
  const reward = ethers.parseEther("20");
  const description = "Test Task";

  beforeEach(async function () {
    [owner, orchestrator, customer, worker1, worker2] = await ethers.getSigners();

    const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
    // Only deploy TaskManager. It deploys Escrow inside its constructor.
    taskManager = await TaskManager.deploy(await orchestrator.getAddress(), await owner.getAddress());

    const escrowAddress = await taskManager.escrow();
    const Escrow = await ethers.getContractFactory("ParallaxEscrow");
    escrow = Escrow.attach(escrowAddress);
  });

  describe("Deployment & Atomic Initialization", function () {
    it("should deploy escrow automatically and set taskManager correctly", async function () {
      expect(await escrow.taskManager()).to.equal(await taskManager.getAddress());
    });

    it("should not allow anyone to call setTaskManager (since it was removed)", async function () {
      expect(escrow.setTaskManager).to.be.undefined;
    });
  });

  describe("Task Creation", function () {
    it("should allow customer to create a task and fund escrow", async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 },
        { rangeLabel: "101-200", description: "Second batch", reward: reward, leaseDuration: 3600 }
      ];

      const totalReward = reward * 2n;

      await expect(taskManager.connect(customer).createTask(description, 0, subtaskInputs, { value: totalReward }))
        .to.emit(taskManager, "TaskCreated");

      // We can't easily get the taskId emitted without parsing the receipt,
      // but we can check the escrow balance of the contract
      const escrowBalance = await ethers.provider.getBalance(await escrow.getAddress());
      expect(escrowBalance).to.equal(totalReward);
    });
  });

  describe("Subtask Claiming & Submission", function () {
    let taskId: string;
    let subtaskId1: string;

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];

      const tx = await taskManager.connect(customer).createTask(description, 0, subtaskInputs, { value: reward });
      const receipt = await tx.wait();
      
      // Parse TaskCreated event to get taskId
      const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated');
      taskId = event.args[0];

      // Parse SubtaskCreated event to get subtaskId
      const subtaskEvent = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated');
      subtaskId1 = subtaskEvent.args[1];

      await taskManager.connect(worker1).stake({ value: ethers.parseEther("20.0") });
    });

    it("should allow worker to claim subtask", async function () {
      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1))
        .to.emit(taskManager, "SubtaskClaimed")
        .withArgs(taskId, subtaskId1, await worker1.getAddress());
      
      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.worker).to.equal(await worker1.getAddress());
    });

    it("should allow worker to submit proof", async function () {
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
      const submissionCID = "QmTestCID1234567890";
      
      await expect(taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionCID))
        .to.emit(taskManager, "SubmissionProofRecorded")
        .withArgs(taskId, subtaskId1, submissionCID);
    });
  });

  describe("Verification & Payout", function () {
    let taskId: string;
    let subtaskId1: string;
    const submissionCID = "QmTestCID1234567890";

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];

      const tx = await taskManager.connect(customer).createTask(description, 0, subtaskInputs, { value: reward });
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated');
      taskId = event.args[0];

      const subtaskEvent = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated');
      subtaskId1 = subtaskEvent.args[1];

      await taskManager.connect(worker1).stake({ value: ethers.parseEther("20.0") });
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, submissionCID);
    });

    it("only orchestrator can verify", async function () {
      await expect(taskManager.connect(worker1).verifySubtask(taskId, subtaskId1, true, 100))
        .to.be.revertedWith("Only orchestrator can call this");
    });

    it("successful verification pays exactly once", async function () {
      const initialBalance = await ethers.provider.getBalance(await worker1.getAddress());

      const expectedWorkerPayout = (reward * 95n) / 100n;
      const expectedPlatformFee = reward - expectedWorkerPayout;

      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, true, 100))
        .to.emit(taskManager, "SubtaskVerified")
        .withArgs(taskId, subtaskId1, true, 100)
        .and.to.emit(escrow, "PaymentReleased")
        .withArgs(taskId, subtaskId1, await worker1.getAddress(), expectedWorkerPayout, expectedPlatformFee);

      const finalBalance = await ethers.provider.getBalance(await worker1.getAddress());
      
      expect(finalBalance - initialBalance).to.equal(expectedWorkerPayout);
    });

    it("rejected verification pays nothing and resets state", async function () {
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 50))
        .to.emit(taskManager, "SubtaskVerified")
        .withArgs(taskId, subtaskId1, false, 50);

      const subtask = await taskManager.subtasks(subtaskId1);
      expect(subtask.state).to.equal(0); // 0 is CREATED state
      expect(subtask.worker).to.equal("0x0000000000000000000000000000000000000000");
    });
  });

  describe("Reputation System", function () {
    let taskId: string;
    let subtaskId1: string;

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];

      // Requires a minReputation of 5
      const tx = await taskManager.connect(customer).createTask("Rep Task", 5, subtaskInputs, { value: reward });
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated');
      taskId = event.args[0];

      subtaskId1 = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated').args[1];

      await taskManager.connect(worker1).stake({ value: ethers.parseEther("20.0") });
      await taskManager.connect(worker2).stake({ value: ethers.parseEther("20.0") });
    });

    it("prevents workers with insufficient reputation from claiming", async function () {
      // worker1 has 0 reputation, should fail
      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1))
        .to.be.revertedWith("Reputation too low");
    });

    it("updates reputation upon verification", async function () {
      // First, create a task with 0 minReputation so worker1 can build rep
      const subtaskInputs = [
        { rangeLabel: "easy", description: "Easy task", reward: reward, leaseDuration: 3600 }
      ];
      const tx = await taskManager.connect(customer).createTask("Easy Task", 0, subtaskInputs, { value: reward });
      const receipt = await tx.wait();
      const subtaskEvent = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated');
      const easySubtaskId = subtaskEvent.args[1];
      const easyTaskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated').args[0];

      // worker1 completes it successfully
      await taskManager.connect(worker1).claimSubtask(easyTaskId, easySubtaskId);
      await taskManager.connect(worker1).recordSubmissionProof(easyTaskId, easySubtaskId, "QmHash1");
      await taskManager.connect(orchestrator).verifySubtask(easyTaskId, easySubtaskId, true, 100);

      // Verify reputation increased
      let profile = await taskManager.workerProfiles(await worker1.getAddress());
      expect(profile.successfulTasks).to.equal(1);
      expect(profile.reputationScore).to.equal(10); // +10 for pass

      // Now worker1 can claim the restricted task (minReputation 5)
      await expect(taskManager.connect(worker1).claimSubtask(taskId, subtaskId1))
        .to.emit(taskManager, "SubtaskClaimed");
        
      // worker1 fails this one
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, "QmHash2");
      await taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 20);

      // Verify reputation decreased
      profile = await taskManager.workerProfiles(await worker1.getAddress());
      expect(profile.failedTasks).to.equal(1);
      expect(profile.reputationScore).to.equal(5); // 10 - 5 = 5
    });
  });

  describe("Staking & Slashing", function () {
    let taskId: string;
    let subtaskId1: string;

    beforeEach(async function () {
      const subtaskInputs = [
        { rangeLabel: "0-100", description: "First batch", reward: reward, leaseDuration: 3600 }
      ];
      const tx = await taskManager.connect(customer).createTask("Task", 0, subtaskInputs, { value: reward });
      const receipt = await tx.wait();
      taskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated').args[0];
      subtaskId1 = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated').args[1];
    });

    it("should allow worker to stake and unstake", async function () {
      await expect(taskManager.connect(worker1).stake({ value: ethers.parseEther("50.0") }))
        .to.emit(taskManager, "StakeDeposited")
        .withArgs(await worker1.getAddress(), ethers.parseEther("50.0"), ethers.parseEther("50.0"));

      await expect(taskManager.connect(worker1).unstake(ethers.parseEther("20.0")))
        .to.emit(taskManager, "StakeWithdrawn")
        .withArgs(await worker1.getAddress(), ethers.parseEther("20.0"), ethers.parseEther("30.0"));
        
      expect(await taskManager.workerStakes(await worker1.getAddress())).to.equal(ethers.parseEther("30.0"));
    });

    it("slashes worker stake when verification fails and sends to platformTreasury", async function () {
      const initialTreasuryBalance = await ethers.provider.getBalance(await owner.getAddress());
      
      // Worker stakes exactly enough to claim
      await taskManager.connect(worker1).stake({ value: reward });
      await taskManager.connect(worker1).claimSubtask(taskId, subtaskId1);
      await taskManager.connect(worker1).recordSubmissionProof(taskId, subtaskId1, "QmHash");
      
      // Fail verification -> slashes reward amount
      await expect(taskManager.connect(orchestrator).verifySubtask(taskId, subtaskId1, false, 30))
        .to.emit(taskManager, "StakeSlashed")
        .withArgs(await worker1.getAddress(), reward);
        
      expect(await taskManager.workerStakes(await worker1.getAddress())).to.equal(0);
      
      const finalTreasuryBalance = await ethers.provider.getBalance(await owner.getAddress());
      // Treasury balance should increase by the slashed reward amount
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(reward);
    });

    it("slashes half the reward amount when claim is forfeited", async function () {
      // Create task with very short lease
      const shortInputs = [{ rangeLabel: "0-100", description: "Quick", reward: reward, leaseDuration: 0 }];
      const tx = await taskManager.connect(customer).createTask("Quick", 0, shortInputs, { value: reward });
      const receipt = await tx.wait();
      const shortTaskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'TaskCreated').args[0];
      const shortSubtaskId = receipt.logs.find((log: any) => log.fragment && log.fragment.name === 'SubtaskCreated').args[1];

      await taskManager.connect(worker1).stake({ value: reward });
      await taskManager.connect(worker1).claimSubtask(shortTaskId, shortSubtaskId);
      
      const expectedSlash = reward / 2n;

      // Anyone can forfeit since lease is 0
      await expect(taskManager.connect(customer).forfeitClaim(shortTaskId, shortSubtaskId))
        .to.emit(taskManager, "StakeSlashed")
        .withArgs(await worker1.getAddress(), expectedSlash);
        
      expect(await taskManager.workerStakes(await worker1.getAddress())).to.equal(reward - expectedSlash);
    });
  });
});

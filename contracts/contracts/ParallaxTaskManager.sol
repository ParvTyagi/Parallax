// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ParallaxEscrow.sol";

contract ParallaxTaskManager {
    ParallaxEscrow public escrow;
    address public orchestrator;
    address public platformTreasury;
    uint256 public totalProtocolRevenue;

    enum SubtaskState {
        CREATED,
        CLAIMED,
        SUBMITTED,
        VERIFIED,
        REJECTED
    }

    struct Task {
        address creator;
        uint256 budget;
        int256 minReputation;
        bool exists;
    }

    struct Subtask {
        bytes32 taskId;
        address worker;
        uint256 reward;
        SubtaskState state;
        string submissionCID;
        uint8 score;
        bool exists;
        uint256 leaseDuration;
        uint256 claimTime;
    }

    struct WorkerProfile {
        uint256 successfulTasks;
        uint256 failedTasks;
        int256 reputationScore;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Subtask) public subtasks;
    mapping(address => WorkerProfile) public workerProfiles;
    mapping(address => uint256) public workerStakes;

    event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description);
    event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration);
    event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker);
    event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, string submissionCID);
    event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score);
    event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId);
    event ReputationUpdated(address indexed worker, int256 newScore, uint256 successfulTasks, uint256 failedTasks);
    event StakeDeposited(address indexed worker, uint256 amount, uint256 newTotal);
    event StakeWithdrawn(address indexed worker, uint256 amount, uint256 newTotal);
    event StakeSlashed(address indexed worker, uint256 amount);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call this");
        _;
    }

    constructor(address _orchestrator, address _platformTreasury) {
        escrow = new ParallaxEscrow(address(this), _platformTreasury);
        orchestrator = _orchestrator;
        platformTreasury = _platformTreasury;
    }

    function stake() external payable {
        require(msg.value > 0, "Must stake more than 0");
        workerStakes[msg.sender] += msg.value;
        emit StakeDeposited(msg.sender, msg.value, workerStakes[msg.sender]);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "Must unstake more than 0");
        require(workerStakes[msg.sender] >= amount, "Insufficient stake");
        workerStakes[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Unstake transfer failed");
        
        emit StakeWithdrawn(msg.sender, amount, workerStakes[msg.sender]);
    }

    struct SubtaskInput {
        string rangeLabel;
        string description;
        uint256 reward;
        uint256 leaseDuration;
    }

    function createTask(string memory description, int256 minReputation, SubtaskInput[] memory subtasksInputs) external payable {
        bytes32 taskId = keccak256(abi.encodePacked(description, block.timestamp, msg.sender));
        require(!tasks[taskId].exists, "Task already exists");

        uint256 totalReward = 0;
        for (uint i = 0; i < subtasksInputs.length; i++) {
            totalReward += subtasksInputs[i].reward;
        }
        require(msg.value == totalReward, "Value must equal total rewards");

        tasks[taskId] = Task({
            creator: msg.sender,
            budget: totalReward,
            minReputation: minReputation,
            exists: true
        });

        escrow.deposit{value: msg.value}(taskId);
        emit TaskCreated(taskId, msg.sender, totalReward, description);

        for (uint i = 0; i < subtasksInputs.length; i++) {
            bytes32 subtaskId = keccak256(abi.encodePacked(taskId, i));
            subtasks[subtaskId] = Subtask({
                taskId: taskId,
                worker: address(0),
                reward: subtasksInputs[i].reward,
                state: SubtaskState.CREATED,
                submissionCID: "",
                score: 0,
                exists: true,
                leaseDuration: subtasksInputs[i].leaseDuration,
                claimTime: 0
            });
            emit SubtaskCreated(taskId, subtaskId, subtasksInputs[i].rangeLabel, subtasksInputs[i].description, subtasksInputs[i].reward, subtasksInputs[i].leaseDuration);
        }
    }

    function claimSubtask(bytes32 taskId, bytes32 subtaskId) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.CREATED, "Subtask not available to claim");
        require(workerProfiles[msg.sender].reputationScore >= tasks[taskId].minReputation, "Reputation too low");
        require(workerStakes[msg.sender] >= subtask.reward, "Insufficient stake to cover slash risk");

        subtask.worker = msg.sender;
        subtask.state = SubtaskState.CLAIMED;
        subtask.claimTime = block.timestamp;

        emit SubtaskClaimed(taskId, subtaskId, msg.sender);
    }

    function forfeitClaim(bytes32 taskId, bytes32 subtaskId) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.CLAIMED, "Subtask must be in CLAIMED state");
        
        bool isVoluntary = msg.sender == subtask.worker;
        
        if (!isVoluntary) {
            require(block.timestamp > subtask.claimTime + subtask.leaseDuration, "Lease has not expired yet, only the worker can forfeit voluntarily.");
        }

        address worker = subtask.worker;
        
        workerProfiles[worker].failedTasks++;
        workerProfiles[worker].reputationScore -= isVoluntary ? int256(1) : int256(2); // Less reputation damage for being honest and returning it early
        emit ReputationUpdated(worker, workerProfiles[worker].reputationScore, workerProfiles[worker].successfulTasks, workerProfiles[worker].failedTasks);

        // Slash amount: 10% for voluntary return, 50% for letting it expire (hoarding)
        uint256 slashAmount = isVoluntary ? (subtask.reward / 10) : (subtask.reward / 2);
        
        if (workerStakes[worker] >= slashAmount) {
            workerStakes[worker] -= slashAmount;
            totalProtocolRevenue += slashAmount;
            (bool success, ) = platformTreasury.call{value: slashAmount}("");
            require(success, "Slash transfer failed");
            emit StakeSlashed(worker, slashAmount);
        }

        subtask.state = SubtaskState.CREATED;
        subtask.worker = address(0);
        subtask.claimTime = 0;

        emit ClaimForfeited(taskId, subtaskId);
    }

    function recordSubmissionProof(bytes32 taskId, bytes32 subtaskId, string memory submissionCID) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.worker == msg.sender, "Only the claiming worker can submit");
        require(subtask.state == SubtaskState.CLAIMED, "Subtask must be in CLAIMED state");
        
        // Prevent submission if lease expired (they should forfeit instead)
        require(block.timestamp <= subtask.claimTime + subtask.leaseDuration, "Lease has expired");

        subtask.submissionCID = submissionCID;
        subtask.state = SubtaskState.SUBMITTED;

        emit SubmissionProofRecorded(taskId, subtaskId, submissionCID);
    }

    function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external onlyOrchestrator {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.SUBMITTED, "Subtask must be in SUBMITTED state");

        subtask.score = score;

        if (passed) {
            subtask.state = SubtaskState.VERIFIED;
            workerProfiles[subtask.worker].successfulTasks++;
            workerProfiles[subtask.worker].reputationScore += 10;
            emit SubtaskVerified(taskId, subtaskId, true, score);
            emit ReputationUpdated(subtask.worker, workerProfiles[subtask.worker].reputationScore, workerProfiles[subtask.worker].successfulTasks, workerProfiles[subtask.worker].failedTasks);
            escrow.releasePayment(taskId, subtaskId, subtask.worker, subtask.reward);
        } else {
            subtask.state = SubtaskState.CREATED;
            address previousWorker = subtask.worker;
            workerProfiles[previousWorker].failedTasks++;
            workerProfiles[previousWorker].reputationScore -= 5;
            emit SubtaskVerified(taskId, subtaskId, false, score);
            emit ReputationUpdated(previousWorker, workerProfiles[previousWorker].reputationScore, workerProfiles[previousWorker].successfulTasks, workerProfiles[previousWorker].failedTasks);

            // Slash stake
            uint256 slashAmount = subtask.reward;
            if (workerStakes[previousWorker] >= slashAmount) {
                workerStakes[previousWorker] -= slashAmount;
                totalProtocolRevenue += slashAmount;
                (bool success, ) = platformTreasury.call{value: slashAmount}("");
                require(success, "Slash transfer failed");
                emit StakeSlashed(previousWorker, slashAmount);
            }

            subtask.worker = address(0);
            subtask.claimTime = 0;
            subtask.submissionCID = "";
        }
    }
}

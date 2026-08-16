// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ParallaxEscrow.sol";

contract ParallaxTaskManager {
    ParallaxEscrow public escrow;
    address public orchestrator;

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
        bool exists;
    }

    struct Subtask {
        bytes32 taskId;
        address worker;
        uint256 reward;
        SubtaskState state;
        bytes32 submissionHash;
        uint8 score;
        bool exists;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Subtask) public subtasks;

    event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget);
    event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward);
    event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker);
    event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash);
    event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call this");
        _;
    }

    constructor(address _escrowAddress, address _orchestrator) {
        escrow = ParallaxEscrow(_escrowAddress);
        orchestrator = _orchestrator;
    }

    struct SubtaskInput {
        string rangeLabel;
        string description;
        uint256 reward;
    }

    function createTask(string memory description, SubtaskInput[] memory subtasksInputs) external payable {
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
            exists: true
        });

        escrow.deposit{value: msg.value}(taskId);
        emit TaskCreated(taskId, msg.sender, totalReward);

        for (uint i = 0; i < subtasksInputs.length; i++) {
            bytes32 subtaskId = keccak256(abi.encodePacked(taskId, i));
            subtasks[subtaskId] = Subtask({
                taskId: taskId,
                worker: address(0),
                reward: subtasksInputs[i].reward,
                state: SubtaskState.CREATED,
                submissionHash: bytes32(0),
                score: 0,
                exists: true
            });
            emit SubtaskCreated(taskId, subtaskId, subtasksInputs[i].rangeLabel, subtasksInputs[i].description, subtasksInputs[i].reward);
        }
    }

    function createSubtask(bytes32 taskId, bytes32 subtaskId, string memory rangeLabel, string memory description, uint256 reward) external {
        require(tasks[taskId].exists, "Task does not exist");
        require(tasks[taskId].creator == msg.sender, "Only task creator can add subtasks");
        require(!subtasks[subtaskId].exists, "Subtask already exists");

        subtasks[subtaskId] = Subtask({
            taskId: taskId,
            worker: address(0),
            reward: reward,
            state: SubtaskState.CREATED,
            submissionHash: bytes32(0),
            score: 0,
            exists: true
        });

        emit SubtaskCreated(taskId, subtaskId, rangeLabel, description, reward);
    }

    function claimSubtask(bytes32 taskId, bytes32 subtaskId) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.CREATED, "Subtask not available to claim");

        subtask.worker = msg.sender;
        subtask.state = SubtaskState.CLAIMED;

        emit SubtaskClaimed(taskId, subtaskId, msg.sender);
    }

    function recordSubmissionProof(bytes32 taskId, bytes32 subtaskId, bytes32 submissionHash) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.worker == msg.sender, "Only the claiming worker can submit");
        require(subtask.state == SubtaskState.CLAIMED, "Subtask must be in CLAIMED state");

        subtask.submissionHash = submissionHash;
        subtask.state = SubtaskState.SUBMITTED;

        emit SubmissionProofRecorded(taskId, subtaskId, submissionHash);
    }

    function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external onlyOrchestrator {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.SUBMITTED, "Subtask must be in SUBMITTED state");

        subtask.score = score;

        if (passed) {
            subtask.state = SubtaskState.VERIFIED;
            emit SubtaskVerified(taskId, subtaskId, true, score);
            escrow.releasePayment(taskId, subtaskId, subtask.worker, subtask.reward);
        } else {
            subtask.state = SubtaskState.REJECTED;
            emit SubtaskVerified(taskId, subtaskId, false, score);
        }
    }
}

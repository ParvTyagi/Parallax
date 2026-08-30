// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ParallaxEscrow.sol";

contract ParallaxTaskManager {
    ParallaxEscrow public escrow;
    address public orchestrator;
    address public platformTreasury;
    address public admin;

    uint256 public constant DISPUTE_WINDOW = 48 hours;
    // Minimum MON a worker must bond to claim a subtask. Slashed on failure/spam, returned on
    // an undisputed, successful completion. Admin-tunable to keep the stake proportional to gas costs.
    uint256 public workerBondAmount = 0.01 ether;

    enum SubtaskState {
        CREATED,
        CLAIMED,
        SUBMITTED,
        PENDING_RELEASE, // AI-verified, inside the 48h creator dispute window
        DISPUTED,        // creator raised a dispute; awaiting admin resolution
        VERIFIED,        // dispute window elapsed (or dispute resolved in worker's favor) and funds released
        REJECTED
    }

    struct Task {
        address creator;
        uint256 budget;
        bool exists;
        bool cancelled;
    }

    struct Subtask {
        bytes32 taskId;
        address worker;
        uint256 reward;
        uint256 bondAmount;
        SubtaskState state;
        bytes32 submissionHash;
        uint8 score;
        bool exists;
        uint256 leaseDuration;
        uint256 claimTime;
        uint256 disputeDeadline;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Subtask) public subtasks;

    event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description);
    event TaskCancelled(bytes32 indexed taskId, address indexed creator, uint256 refundedAmount);
    event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration);
    event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker, uint256 bondAmount);
    event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash);
    event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score, uint256 disputeDeadline);
    event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId, bool slashed);
    event PayoutReleased(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker);
    event DisputeRaised(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed creator);
    event DisputeResolved(bytes32 indexed taskId, bytes32 indexed subtaskId, bool workerWins);
    event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);
    event WorkerBondAmountUpdated(uint256 previousAmount, uint256 newAmount);

    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call this");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    constructor(address _orchestrator, address _platformTreasury, address _admin) {
        escrow = new ParallaxEscrow(address(this), _platformTreasury);
        orchestrator = _orchestrator;
        platformTreasury = _platformTreasury;
        admin = _admin;
    }

    function setAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "Admin cannot be zero address");
        emit AdminUpdated(admin, _admin);
        admin = _admin;
    }

    function setWorkerBondAmount(uint256 _amount) external onlyAdmin {
        emit WorkerBondAmountUpdated(workerBondAmount, _amount);
        workerBondAmount = _amount;
    }

    struct SubtaskInput {
        string rangeLabel;
        string description;
        uint256 reward;
        uint256 leaseDuration;
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
            exists: true,
            cancelled: false
        });

        escrow.deposit{value: msg.value}(taskId);
        emit TaskCreated(taskId, msg.sender, totalReward, description);

        for (uint i = 0; i < subtasksInputs.length; i++) {
            bytes32 subtaskId = keccak256(abi.encodePacked(taskId, i));
            subtasks[subtaskId] = Subtask({
                taskId: taskId,
                worker: address(0),
                reward: subtasksInputs[i].reward,
                bondAmount: 0,
                state: SubtaskState.CREATED,
                submissionHash: bytes32(0),
                score: 0,
                exists: true,
                leaseDuration: subtasksInputs[i].leaseDuration,
                claimTime: 0,
                disputeDeadline: 0
            });
            emit SubtaskCreated(taskId, subtaskId, subtasksInputs[i].rangeLabel, subtasksInputs[i].description, subtasksInputs[i].reward, subtasksInputs[i].leaseDuration);
        }
    }

    function cancelTask(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        require(task.exists, "Task does not exist");
        require(!task.cancelled, "Task already cancelled");
        require(task.creator == msg.sender, "Only creator can cancel task");

        uint256 refundable = escrow.escrowBalances(taskId);
        require(refundable > 0, "No funds remaining to refund");

        task.cancelled = true;
        escrow.refund(taskId, msg.sender, refundable);
        emit TaskCancelled(taskId, msg.sender, refundable);
    }

    /// @notice Claims a subtask. Requires the caller to post a MON bond, slashed on failure/spam
    /// and returned once the work is verified and the dispute window elapses without challenge.
    function claimSubtask(bytes32 taskId, bytes32 subtaskId) external payable {
        Task storage task = tasks[taskId];
        require(task.exists, "Task does not exist");
        require(!task.cancelled, "Task has been cancelled");
        require(msg.value >= workerBondAmount, "Insufficient worker bond");

        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.CREATED, "Subtask not available to claim");

        subtask.worker = msg.sender;
        subtask.state = SubtaskState.CLAIMED;
        subtask.claimTime = block.timestamp;
        subtask.bondAmount = msg.value;

        escrow.lockBond{value: msg.value}(msg.sender, subtaskId);

        emit SubtaskClaimed(taskId, subtaskId, msg.sender, msg.value);
    }

    /// @notice Releases a claim. A worker forfeiting voluntarily gets their bond back; a claim
    /// forced open by anyone else after the lease has expired is treated as spam/abandonment and slashed.
    function forfeitClaim(bytes32 taskId, bytes32 subtaskId) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.CLAIMED, "Subtask must be in CLAIMED state");

        bool isWorker = msg.sender == subtask.worker;
        if (!isWorker) {
            require(block.timestamp > subtask.claimTime + subtask.leaseDuration, "Lease has not expired yet");
        }

        address worker = subtask.worker;
        uint256 bond = subtask.bondAmount;

        subtask.state = SubtaskState.CREATED;
        subtask.worker = address(0);
        subtask.claimTime = 0;
        subtask.bondAmount = 0;

        if (bond > 0) {
            if (isWorker) {
                escrow.returnBond(worker, subtaskId, bond);
            } else {
                escrow.slashBond(worker, subtaskId, bond);
            }
        }

        emit ClaimForfeited(taskId, subtaskId, !isWorker);
    }

    function recordSubmissionProof(bytes32 taskId, bytes32 subtaskId, bytes32 submissionHash) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.worker == msg.sender, "Only the claiming worker can submit");
        require(subtask.state == SubtaskState.CLAIMED, "Subtask must be in CLAIMED state");

        // Prevent submission if lease expired
        require(block.timestamp <= subtask.claimTime + subtask.leaseDuration, "Lease has expired");

        subtask.submissionHash = submissionHash;
        subtask.state = SubtaskState.SUBMITTED;

        emit SubmissionProofRecorded(taskId, subtaskId, submissionHash);
    }

    /// @notice Records the AI orchestrator's verdict. On a pass, funds are NOT released immediately —
    /// the subtask enters a 48-hour dispute window the creator can challenge via disputeTask(). On a
    /// fail, the worker's bond is slashed and the subtask reopens for other workers.
    function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external onlyOrchestrator {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.SUBMITTED, "Subtask must be in SUBMITTED state");

        subtask.score = score;

        if (passed) {
            subtask.state = SubtaskState.PENDING_RELEASE;
            subtask.disputeDeadline = block.timestamp + DISPUTE_WINDOW;
            emit SubtaskVerified(taskId, subtaskId, true, score, subtask.disputeDeadline);
        } else {
            address worker = subtask.worker;
            uint256 bond = subtask.bondAmount;

            subtask.state = SubtaskState.CREATED;
            subtask.worker = address(0);
            subtask.claimTime = 0;
            subtask.submissionHash = bytes32(0);
            subtask.bondAmount = 0;

            if (bond > 0) {
                escrow.slashBond(worker, subtaskId, bond);
            }

            emit SubtaskVerified(taskId, subtaskId, false, score, 0);
        }
    }

    /// @notice Callable by anyone once the dispute window has elapsed without challenge. Pays the
    /// worker their reward and returns their bond.
    function releasePayout(bytes32 taskId, bytes32 subtaskId) external {
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.PENDING_RELEASE, "Subtask is not pending release");
        require(block.timestamp > subtask.disputeDeadline, "Dispute window still open");

        address worker = subtask.worker;
        uint256 bond = subtask.bondAmount;

        subtask.state = SubtaskState.VERIFIED;
        subtask.bondAmount = 0;

        escrow.releasePayment(taskId, subtaskId, worker, subtask.reward);
        if (bond > 0) {
            escrow.returnBond(worker, subtaskId, bond);
        }

        emit PayoutReleased(taskId, subtaskId, worker);
    }

    /// @notice Lets the task creator challenge a verified subtask within the 48-hour dispute window.
    function disputeTask(bytes32 taskId, bytes32 subtaskId) external {
        Task storage task = tasks[taskId];
        require(task.exists, "Task does not exist");
        require(task.creator == msg.sender, "Only the task creator can dispute");

        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.PENDING_RELEASE, "Subtask is not pending release");
        require(block.timestamp <= subtask.disputeDeadline, "Dispute window has closed");

        subtask.state = SubtaskState.DISPUTED;

        emit DisputeRaised(taskId, subtaskId, msg.sender);
    }

    /// @notice Admin-only resolution of a disputed subtask. `workerWins == true` pays the worker and
    /// returns their bond; `workerWins == false` refunds the creator's escrowed reward and slashes
    /// the worker's bond.
    function resolveDispute(bytes32 taskId, bytes32 subtaskId, bool workerWins) external onlyAdmin {
        Task storage task = tasks[taskId];
        Subtask storage subtask = subtasks[subtaskId];
        require(subtask.exists, "Subtask does not exist");
        require(subtask.taskId == taskId, "Task ID mismatch");
        require(subtask.state == SubtaskState.DISPUTED, "Subtask is not under dispute");

        address worker = subtask.worker;
        uint256 bond = subtask.bondAmount;

        subtask.bondAmount = 0;

        if (workerWins) {
            subtask.state = SubtaskState.VERIFIED;
            escrow.releasePayment(taskId, subtaskId, worker, subtask.reward);
            if (bond > 0) {
                escrow.returnBond(worker, subtaskId, bond);
            }
        } else {
            subtask.state = SubtaskState.REJECTED;
            escrow.refund(taskId, task.creator, subtask.reward);
            if (bond > 0) {
                escrow.slashBond(worker, subtaskId, bond);
            }
        }

        emit DisputeResolved(taskId, subtaskId, workerWins);
    }
}

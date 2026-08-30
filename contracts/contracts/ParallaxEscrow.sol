// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ParallaxEscrow {
    address public taskManager;
    address public platformTreasury;
    uint256 public platformFeePercentage = 5; // 5% fee
    uint256 public totalProtocolRevenue;

    // taskId => amount escrowed
    mapping(bytes32 => uint256) public escrowBalances;
    // subtaskId => paid
    mapping(bytes32 => bool) public subtaskPaid;
    // worker => bonded MON currently locked against claimed subtasks
    mapping(address => uint256) public workerBonds;

    event Deposited(bytes32 indexed taskId, uint256 amount);
    event PaymentReleased(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, uint256 workerPayout, uint256 platformFee);
    event Refunded(bytes32 indexed taskId, address creator, uint256 amount);
    event BondLocked(address indexed worker, bytes32 indexed subtaskId, uint256 amount);
    event BondReturned(address indexed worker, bytes32 indexed subtaskId, uint256 amount);
    event BondSlashed(address indexed worker, bytes32 indexed subtaskId, uint256 amount);

    modifier onlyTaskManager() {
        require(msg.sender == taskManager, "Only TaskManager can call this");
        _;
    }

    modifier onlyTreasury() {
        require(msg.sender == platformTreasury, "Only Treasury can call this");
        _;
    }

    constructor(address _taskManager, address _platformTreasury) {
        taskManager = _taskManager;
        platformTreasury = _platformTreasury;
    }

    function updateFee(uint256 _newFee) external onlyTreasury {
        require(_newFee <= 20, "Fee too high"); // max 20%
        platformFeePercentage = _newFee;
    }

    function deposit(bytes32 taskId) external payable {
        escrowBalances[taskId] += msg.value;
        emit Deposited(taskId, msg.value);
    }

    /// @notice Locks a worker's bond, forwarded from the TaskManager alongside a claim.
    function lockBond(address worker, bytes32 subtaskId) external payable onlyTaskManager {
        require(msg.value > 0, "Bond required");
        workerBonds[worker] += msg.value;
        emit BondLocked(worker, subtaskId, msg.value);
    }

    /// @notice Returns a worker's bond after a successful, undisputed completion or a clean forfeit.
    function returnBond(address worker, bytes32 subtaskId, uint256 amount) external onlyTaskManager {
        require(workerBonds[worker] >= amount, "Bond underflow");
        workerBonds[worker] -= amount;
        (bool success, ) = worker.call{value: amount}("");
        require(success, "Bond return failed");
        emit BondReturned(worker, subtaskId, amount);
    }

    /// @notice Slashes a worker's bond to the treasury on failure, spam, or a lost dispute.
    function slashBond(address worker, bytes32 subtaskId, uint256 amount) external onlyTaskManager {
        require(workerBonds[worker] >= amount, "Bond underflow");
        workerBonds[worker] -= amount;
        if (amount > 0) {
            totalProtocolRevenue += amount;
            (bool success, ) = platformTreasury.call{value: amount}("");
            require(success, "Slash transfer failed");
        }
        emit BondSlashed(worker, subtaskId, amount);
    }

    function releasePayment(bytes32 taskId, bytes32 subtaskId, address worker, uint256 reward) external onlyTaskManager {
        require(!subtaskPaid[subtaskId], "Subtask already paid");
        require(escrowBalances[taskId] >= reward, "Insufficient escrow balance");

        subtaskPaid[subtaskId] = true;
        escrowBalances[taskId] -= reward;

        uint256 platformFee = (reward * platformFeePercentage) / 100;
        uint256 workerPayout = reward - platformFee;

        // Pay worker
        (bool successWorker, ) = worker.call{value: workerPayout}("");
        require(successWorker, "Worker payment failed");

        // Pay treasury
        if (platformFee > 0) {
            totalProtocolRevenue += platformFee;
            (bool successTreasury, ) = platformTreasury.call{value: platformFee}("");
            require(successTreasury, "Treasury payment failed");
        }

        emit PaymentReleased(taskId, subtaskId, worker, workerPayout, platformFee);
    }

    function refund(bytes32 taskId, address creator, uint256 amount) external onlyTaskManager {
        require(escrowBalances[taskId] >= amount, "Insufficient escrow balance");

        escrowBalances[taskId] -= amount;

        (bool success, ) = creator.call{value: amount}("");
        require(success, "Refund failed");

        emit Refunded(taskId, creator, amount);
    }
}

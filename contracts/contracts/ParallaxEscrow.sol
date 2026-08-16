// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ParallaxEscrow {
    address public taskManager;
    
    // taskId => amount escrowed
    mapping(bytes32 => uint256) public escrowBalances;
    // subtaskId => paid
    mapping(bytes32 => bool) public subtaskPaid;

    event Deposited(bytes32 indexed taskId, uint256 amount);
    event PaymentReleased(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, uint256 reward);
    event Refunded(bytes32 indexed taskId, address creator, uint256 amount);

    modifier onlyTaskManager() {
        require(msg.sender == taskManager, "Only TaskManager can call this");
        _;
    }

    constructor() {}

    function setTaskManager(address _taskManager) external {
        require(taskManager == address(0), "TaskManager already set");
        taskManager = _taskManager;
    }

    function deposit(bytes32 taskId) external payable {
        escrowBalances[taskId] += msg.value;
        emit Deposited(taskId, msg.value);
    }

    function releasePayment(bytes32 taskId, bytes32 subtaskId, address worker, uint256 reward) external onlyTaskManager {
        require(!subtaskPaid[subtaskId], "Subtask already paid");
        require(escrowBalances[taskId] >= reward, "Insufficient escrow balance");

        subtaskPaid[subtaskId] = true;
        escrowBalances[taskId] -= reward;
        
        (bool success, ) = worker.call{value: reward}("");
        require(success, "Payment failed");

        emit PaymentReleased(taskId, subtaskId, worker, reward);
    }

    function refund(bytes32 taskId, address creator, uint256 amount) external onlyTaskManager {
        require(escrowBalances[taskId] >= amount, "Insufficient escrow balance");

        escrowBalances[taskId] -= amount;
        
        (bool success, ) = creator.call{value: amount}("");
        require(success, "Refund failed");

        emit Refunded(taskId, creator, amount);
    }
}

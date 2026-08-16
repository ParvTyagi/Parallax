export const TASK_MANAGER_ADDRESS = "0x5552bA4375A4102271a08E29bEB721F87E9c14E6";

export const TASK_MANAGER_ABI = [
  "function createTask(string memory description, tuple(string rangeLabel, string description, uint256 reward)[] memory subtasks) external payable",
  "function claimSubtask(bytes32 taskId, bytes32 subtaskId) external",
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external",
  "event TaskCreated(bytes32 indexed taskId, address indexed customer, string description, uint256 budget)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, bool passed, uint8 score)",
  "event PayoutIssued(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, uint256 amount)"
];

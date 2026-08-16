export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
export const TASK_MANAGER_ADDRESS = "0x79430B85C3c5d762FbBF178DbADaF7981798C412";

export const TASK_MANAGER_ABI = [
  "function createTask(string memory description, tuple(string rangeLabel, string description, uint256 reward, uint256 leaseDuration)[] memory subtasks) external payable",
  "function claimSubtask(bytes32 taskId, bytes32 subtaskId) external",
  "function recordSubmissionProof(bytes32 taskId, bytes32 subtaskId, bytes32 submissionHash) external",
  "function forfeitClaim(bytes32 taskId, bytes32 subtaskId) external",
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external",
  "event TaskCreated(bytes32 indexed taskId, address indexed customer, string description, uint256 budget)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker)",
  "event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, bool passed, uint8 score)",
  "event PayoutIssued(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker, uint256 amount)"
];

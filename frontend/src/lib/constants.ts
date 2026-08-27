export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://parallax-8yob.onrender.com"
    : "http://localhost:3000");

export const TASK_MANAGER_ADDRESS =
  import.meta.env.VITE_TASKMANAGER_ADDRESS || "0x8a50d0208c719cBB92094f3A18A072Ce37cad974";

export const TASK_MANAGER_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_orchestrator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_platformTreasury",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      }
    ],
    "name": "ClaimForfeited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "newScore",
        "type": "int256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "successfulTasks",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "failedTasks",
        "type": "uint256"
      }
    ],
    "name": "ReputationUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newTotal",
        "type": "uint256"
      }
    ],
    "name": "StakeDeposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "StakeSlashed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newTotal",
        "type": "uint256"
      }
    ],
    "name": "StakeWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "submissionCID",
        "type": "string"
      }
    ],
    "name": "SubmissionProofRecorded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "SubtaskClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "rangeLabel",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "leaseDuration",
        "type": "uint256"
      }
    ],
    "name": "SubtaskCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "passed",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "score",
        "type": "uint8"
      }
    ],
    "name": "SubtaskVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "budget",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "description",
        "type": "string"
      }
    ],
    "name": "TaskCreated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      }
    ],
    "name": "claimSubtask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "internalType": "int256",
        "name": "minReputation",
        "type": "int256"
      },
      {
        "components": [
          {
            "internalType": "string",
            "name": "rangeLabel",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "reward",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "leaseDuration",
            "type": "uint256"
          }
        ],
        "internalType": "struct ParallaxTaskManager.SubtaskInput[]",
        "name": "subtasksInputs",
        "type": "tuple[]"
      }
    ],
    "name": "createTask",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "escrow",
    "outputs": [
      {
        "internalType": "contract ParallaxEscrow",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      }
    ],
    "name": "forfeitClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "orchestrator",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformTreasury",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "submissionCID",
        "type": "string"
      }
    ],
    "name": "recordSubmissionProof",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "stake",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "subtasks",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "internalType": "enum ParallaxTaskManager.SubtaskState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "submissionCID",
        "type": "string"
      },
      {
        "internalType": "uint8",
        "name": "score",
        "type": "uint8"
      },
      {
        "internalType": "bool",
        "name": "exists",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "leaseDuration",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "claimTime",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "tasks",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "budget",
        "type": "uint256"
      },
      {
        "internalType": "int256",
        "name": "minReputation",
        "type": "int256"
      },
      {
        "internalType": "bool",
        "name": "exists",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalProtocolRevenue",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "unstake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "taskId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "subtaskId",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "passed",
        "type": "bool"
      },
      {
        "internalType": "uint8",
        "name": "score",
        "type": "uint8"
      }
    ],
    "name": "verifySubtask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "workerProfiles",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "successfulTasks",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "failedTasks",
        "type": "uint256"
      },
      {
        "internalType": "int256",
        "name": "reputationScore",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "workerStakes",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

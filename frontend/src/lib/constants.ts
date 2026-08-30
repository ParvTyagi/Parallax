export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://parallax-8yob.onrender.com"
    : "http://localhost:3000");

export const TASK_MANAGER_ADDRESS =
  import.meta.env.VITE_TASKMANAGER_ADDRESS || "0x7371e2777cD7Cbf9d3bE33F780122C1C9C9A4F20";

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
      },
      {
        "internalType": "address",
        "name": "_admin",
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
        "internalType": "address",
        "name": "previousAdmin",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "AdminUpdated",
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
        "name": "slashed",
        "type": "bool"
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
        "name": "creator",
        "type": "address"
      }
    ],
    "name": "DisputeRaised",
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
        "name": "workerWins",
        "type": "bool"
      }
    ],
    "name": "DisputeResolved",
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
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "PayoutReleased",
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
        "internalType": "bytes32",
        "name": "submissionHash",
        "type": "bytes32"
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
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "bondAmount",
        "type": "uint256"
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
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "disputeDeadline",
        "type": "uint256"
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
        "name": "refundedAmount",
        "type": "uint256"
      }
    ],
    "name": "TaskCancelled",
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
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "previousAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newAmount",
        "type": "uint256"
      }
    ],
    "name": "WorkerBondAmountUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DISPUTE_WINDOW",
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
    "inputs": [],
    "name": "admin",
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
      }
    ],
    "name": "cancelTask",
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
      }
    ],
    "name": "claimSubtask",
    "outputs": [],
    "stateMutability": "payable",
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
    "name": "disputeTask",
    "outputs": [],
    "stateMutability": "nonpayable",
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
        "internalType": "bytes32",
        "name": "submissionHash",
        "type": "bytes32"
      }
    ],
    "name": "recordSubmissionProof",
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
      }
    ],
    "name": "releasePayout",
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
        "name": "workerWins",
        "type": "bool"
      }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_admin",
        "type": "address"
      }
    ],
    "name": "setAdmin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      }
    ],
    "name": "setWorkerBondAmount",
    "outputs": [],
    "stateMutability": "nonpayable",
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
        "internalType": "uint256",
        "name": "bondAmount",
        "type": "uint256"
      },
      {
        "internalType": "enum ParallaxTaskManager.SubtaskState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "submissionHash",
        "type": "bytes32"
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
      },
      {
        "internalType": "uint256",
        "name": "disputeDeadline",
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
        "internalType": "bool",
        "name": "exists",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "cancelled",
        "type": "bool"
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
    "inputs": [],
    "name": "workerBondAmount",
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

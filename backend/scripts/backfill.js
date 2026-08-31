require('dotenv').config();
const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');

const ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)"
];

const prisma = new PrismaClient();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL, undefined, { staticNetwork: true });
  const contract = new ethers.Contract(process.env.TASKMANAGER_ADDRESS, ABI, provider);
  const currentBlock = await provider.getBlockNumber();
  const totalRange = 5000;
  const chunk = 99;
  let found = [];
  for (let start = currentBlock - totalRange; start <= currentBlock; start += chunk) {
    const end = Math.min(start + chunk, currentBlock);
    try {
      const events = await contract.queryFilter("*", start, end);
      found.push(...events.filter(e => 'eventName' in e));
    } catch (err) {
      console.error(`chunk ${start}-${end} failed:`, err.shortMessage || err.message);
    }
  }

  for (const event of found) {
    if (event.eventName === "TaskCreated") {
      const [taskId, creator, budget, description] = event.args;
      await prisma.task.upsert({
        where: { taskId },
        update: { status: "ACTIVE" },
        create: {
          taskId, creator, description,
          budget: ethers.formatEther(budget),
          status: "ACTIVE"
        }
      });
      console.log("Backfilled TaskCreated", taskId);
    } else if (event.eventName === "SubtaskCreated") {
      const [taskId, subtaskId, rangeLabel, description, reward, leaseDuration] = event.args;
      await prisma.subtask.upsert({
        where: { subtaskId },
        update: { state: "CREATED" },
        create: {
          subtaskId, taskId, rangeLabel, description,
          reward: ethers.formatEther(reward),
          leaseDuration: Number(leaseDuration),
          state: "CREATED"
        }
      });
      console.log("Backfilled SubtaskCreated", subtaskId);
    }
  }

  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

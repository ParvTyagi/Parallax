require('dotenv').config();
const { ethers } = require('ethers');

const ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)"
];

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL, undefined, { staticNetwork: true });
  const contract = new ethers.Contract(process.env.TASKMANAGER_ADDRESS, ABI, provider);
  const currentBlock = await provider.getBlockNumber();
  console.log('current block', currentBlock);
  const totalRange = 5000;
  const chunk = 99;
  let found = [];
  for (let start = currentBlock - totalRange; start <= currentBlock; start += chunk) {
    const end = Math.min(start + chunk, currentBlock);
    try {
      const events = await contract.queryFilter("*", start, end);
      for (const e of events) {
        if ('eventName' in e) found.push(e);
      }
    } catch (err) {
      console.error(`chunk ${start}-${end} failed:`, err.shortMessage || err.message);
    }
  }
  console.log(`Found ${found.length} events in last ${totalRange} blocks`);
  for (const e of found) {
    console.log(e.blockNumber, e.eventName, e.args?.taskId || e.args?.subtaskId || '', e.transactionHash);
  }
})().catch(e => { console.error(e); process.exit(1); });

<div align="center">
  <h1>Parallax</h1>
  <p><strong>Decentralized AI-Orchestrated Microtasking & Compute Network on Ethereum</strong></p>
</div>

<br/>

> **"The unit of work becomes the unit of payment."**

---

## 📌 Project Overview
**Parallax** is a decentralized, AI-orchestrated microtasking platform built on the **Ethereum blockchain**. It takes complex, monolithic customer requests (such as dataset labeling, smart contract security audits, DeFi market research, or code translation), dynamically decomposes them into granular, independent subtasks using Google's Gemini AI, and distributes them across a distributed pool of freelance workers.

Payments are secured non-custodially via Ethereum smart contracts (`ParallaxTaskManager` and `ParallaxEscrow`). When a worker completes a subtask, their deliverable is hashed on-chain and verified against objective acceptance criteria by the AI Orchestrator. Successful on-chain verification immediately releases payment and returns the worker bond.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    Client["Client / Task Creator"] -->|1. Submit Master Brief & Budget in ETH| Backend["AI Orchestrator (Backend + Gemini API)"]
    Backend -->|2. Decompose into 3-5 Subtasks| Client
    Client -->|3. Approve & Fund Escrow in ETH| TM["ParallaxTaskManager.sol (Ethereum)"]
    TM -->|Deposit Funds| Escrow["ParallaxEscrow.sol (Ethereum)"]

    Worker["Worker / Freelancer"] -->|4. Claim Subtask + Deposit ETH Bond| TM
    TM -->|Lock Bond| Escrow

    Worker -->|5. Upload Deliverable to IPFS & Submit Hash| TM
    TM -.->|Trigger Verification| Backend

    Backend -->|6. AI Grades Acceptance Criteria| TM
    TM -->|7. Passed: Immediately Release Reward + Return Bond| Worker
```

---

## 🚀 Key Features

1. **AI Task Decomposition:** Gemini AI slices high-level project goals into 3 to 5 independent subtasks, each complete with an objective, deliverable format, step-by-step guidance, and objectively checkable criteria.
2. **Parallel Decentralized Execution:** Distributed workers claim individual tasks simultaneously, expediting turnaround times.
3. **Sybil Resistance via Worker Bonds:** Workers must lock an ETH bond to claim a subtask. If they forfeit after the lease expires or submit fraudulent work, their bond is slashed; on successful completion, their bond is refunded in full.
4. **Immediate Verified Payouts:** Successful verification (score at least 70 and all acceptance criteria met) releases the reward and returns the worker bond in the same transaction, with no dispute window. Failed verification preserves the submission, reward and bond so the submitting worker can appeal. Only the admin can resolve an appeal: approval pays the worker and returns the bond; an upheld rejection refunds the creator and slashes the bond. No automatic appeal expiry is imposed. Older deployed contracts cannot be changed by updating this source; deploy the new contract for new projects.
5. **Decentralized Dataset & Proof Storage:** Large datasets and worker deliverables are pinned to IPFS, and cryptographic content hashes are immutably logged on Ethereum.
6. **Master Synthesis & Aggregation:** Once all subtasks are verified, the AI merges the discrete outputs into a unified master deliverable.

---

## 🛠️ Tech Stack

- **Blockchain & Smart Contracts:** Ethereum (Paris EVM), Solidity `^0.8.24`, Hardhat, Ethers.js v6
- **Backend Service:** Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, Google Gemini API
- **Decentralized Storage:** IPFS (via Pinata / local in-memory fallback)
- **Frontend Application:** React 19, TypeScript, Vite, Tailwind CSS, DaisyUI, Lucide Icons
- **Web3 Wallet Support:** MetaMask and any standard EIP-1193 Ethereum provider

---

## 💻 Getting Started (Local Development & Demo)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ or v20+)
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) browser extension
- PostgreSQL database (Local PostgreSQL or a free [Neon](https://neon.tech) / [Supabase](https://supabase.com) instance)
- [Google Gemini API Key](https://aistudio.google.com/)

---

### Step 1: Smart Contracts (Ethereum)

Navigate to the `contracts` folder:
```bash
cd contracts
npm install
npm run compile
```

#### Running Tests:
```bash
npm test
```
All contract tests run against the Ethereum Hardhat EVM.

#### Deployment Options:

**Option A: Localhost Ethereum Node (Recommended for College Viva / Offline Demo)**
1. In a separate terminal, start a local Ethereum node:
   ```bash
   npm run node
   ```
   *This starts an RPC server at `http://127.0.0.1:8545` with 20 test accounts funded with 10,000 ETH each.*

2. In your contracts terminal, deploy:
   ```bash
   npm run deploy:local
   ```
   *The script automatically deploys `ParallaxTaskManager` and `ParallaxEscrow`, saves the addresses in `contracts/deployment.json`, and updates both `frontend/src/lib/constants.ts` and `backend/.env`!*

**Option B: Ethereum Sepolia Testnet**
1. Ensure your `contracts/.env` has:
   ```env
   ETH_RPC_URL=https://rpc.sepolia.org
   DEPLOYER_PRIVATE_KEY=0x...
   ```
2. Deploy to Sepolia:
   ```bash
   npm run deploy:sepolia
   ```

---

### Step 2: Backend Setup

Navigate to the `backend` folder:
```bash
cd ../backend
npm install
```

1. Create a `backend/.env` file (copy from `../.env.example`):
   ```env
   # Ethereum RPC URL:
   # For Localhost: http://127.0.0.1:8545
   # For Sepolia:   https://rpc.sepolia.org
   ETH_RPC_URL=http://127.0.0.1:8545

   # Deployed contract addresses (auto-filled by deploy script):
   TASKMANAGER_ADDRESS=0x...
   ESCROW_ADDRESS=0x...

   # Private key for the orchestrator (can be the same as deployer account):
   ORCHESTRATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

   # Database and AI:
   DATABASE_URL="postgresql://username:password@localhost:5432/parallax?schema=public"
   GEMINI_API_KEY="AIzaSy..."
   ```

2. Initialize the database schema:
   ```bash
   npx prisma db push
   ```

3. Start the backend server:
   ```bash
   npm run dev
   ```
   The backend runs on `http://localhost:3000`.

Worker answers are uploaded through the backend's Pinata/IPFS integration. Set
`PINATA_JWT` or both `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` in `backend/.env`
for public IPFS pinning. The database stores the CID, and the wallet records a
hash of the answer on-chain. Without successful pinning, the existing IPFS helper
falls back to its local cache and database copy; that CID is not publicly resolvable.
Plain IPFS answers are readable by anyone who obtains the CID.
`SUPABASE_URL` and a backend Supabase secret are only needed to read older
`supabase:` submissions; they are not required for new answer submissions.

The active Sepolia deployment is `0xF5C1243881729C16882EA7bbE0a1846e12553EfA`
(escrow `0xdF16FC24b9b137B3bB25F2b7A659b1B068bE834e`, start block `11967798`).
Its dispute window is zero: successful verification pays the reward and returns
the bond in the same transaction. Keep the backend `TASKMANAGER_ADDRESS` and
`ESCROW_ADDRESS` aligned with the frontend `VITE_TASKMANAGER_ADDRESS` and
`VITE_ESCROW_ADDRESS`, then restart both servers (or rebuild the frontend).
The app indexes and displays only this active deployment. Projects and pending
jobs from earlier deployments remain in the database but are excluded from the
app and its verification worker. Old on-chain escrow is not migrated or modified.

---

### Step 3: Frontend Setup

Navigate to the `frontend` folder:
```bash
cd ../frontend
npm install
```

1. Create a `frontend/.env` file:
   ```env
   # For Localhost demo:
   VITE_ETH_CHAIN_ID=0x7a69
   VITE_BLOCK_EXPLORER_URL=http://localhost:8545
   VITE_API_URL=http://localhost:3000

   # Or for Sepolia demo:
   # VITE_ETH_CHAIN_ID=0xaa36a7
   # VITE_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
   # VITE_API_URL=http://localhost:3000
   ```

2. Run the unit and integration tests:
   ```bash
   npm test
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### Step 4: Connecting MetaMask for Demo

1. Open MetaMask and switch network:
   - For **Localhost**: Add network RPC `http://127.0.0.1:8545`, Chain ID `31337`, Symbol `ETH`. Import any of the Hardhat test private keys to get instant 10,000 ETH.
   - For **Sepolia**: Switch to "Sepolia" network in MetaMask. Get free testnet ETH from [Google Cloud Web3 Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/).
2. Connect your wallet in the Parallax web interface to post tasks as a client or claim bounties as a freelancer!

---

## 🎓 Academic / Project Viva Points

- **Why Ethereum?** Parallax leverages the Ethereum Virtual Machine (EVM) standard for trustless escrow logic. By utilizing Ethereum's decentralized consensus, neither the task poster nor the freelancer needs to trust a centralized intermediary to custody or release funds.
- **Novelty:** Traditional freelance platforms (Upwork, Fiverr) charge 10-20% fees and rely on centralized subjective arbitration. Parallax uses Gemini AI for objective criteria verification while keeping payouts locked in on-chain smart contract escrows with cryptographic proof hashes.
- **Economic Safety:** Worker stake bonding and AI verification against acceptance criteria discourage spam and non-delivery while enabling immediate payouts for approved work.

---

## 📄 License
MIT License. Built for academic research and decentralized AI microtasking.

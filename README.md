<div align="center">
  <h1>Parallax</h1>
  <p><strong>The Decentralized AI-Assisted Compute Network on Monad</strong></p>
</div>

<br/>

> **The unit of work becomes the unit of payment.**

---

## 🤔 What is this?
Parallax is a decentralized, AI-orchestrated microtasking platform built on the Monad blockchain. It takes massive, complex customer workloads, dynamically slices them into bite-sized tasks, and distributes them to a global network of workers. Once a worker completes their piece, an AI verifies the work and the Monad smart contract instantly releases the payment.

## ⚠️ Why do we need this?
Currently, decentralized compute networks treat processing as a single, monolithic block. If a customer needs 10,000 images tagged, or a massive codebase refactored, they have to wait for one single worker (or node) to process the entire job sequentially, which is slow and inefficient. Furthermore, verifying subjective or complex work on-chain is notoriously difficult without trusted central authorities.

## 💡 What our project is doing
Parallax solves this by leveraging **Monad's parallel execution capabilities** alongside AI intelligence. 

1. **AI Decomposition:** Customers input a large task; the AI Orchestrator slices it into independent subtasks, each with an explicit objective, deliverable format, and a set of objectively checkable acceptance criteria. The customer reviews and edits that breakdown before anything reaches the chain.
2. **Parallel Execution:** Global workers claim individual chunks simultaneously, dramatically speeding up completion time.
3. **Dynamic Leases:** The AI analyzes task complexity and assigns dynamic lease durations. If a worker doesn't submit in time, the claim is dropped and returned to the pool.
4. **Criterion-Level AI Verification:** Worker submissions are hashed on-chain. The AI Orchestrator grades the off-chain deliverable against each acceptance criterion independently and records the per-criterion verdict, so an approval or rejection is auditable rather than a bare score. Approved work enters a 48-hour dispute window before payout.
5. **Dataset Attachments:** Customers can attach whole folders or multi-file datasets. They are zipped in the browser, pinned to IPFS, and workers can browse the archive's contents or pull a single file without downloading the whole bundle.
6. **Automated Master Aggregation:** When all subtasks reach `VERIFIED` status, the AI seamlessly merges the disjointed worker outputs into one cohesive final solution for the customer.

## 🌐 Live Links

- **Frontend Application (Vercel):** [https://parallax-mu-sand.vercel.app/](https://parallax-mu-sand.vercel.app/)
- **Backend API (Render):** [https://parallax-8yob.onrender.com](https://parallax-8yob.onrender.com)

### Smart Contracts (Monad Testnet)
- `ParallaxEscrow`: [0x5e70Ae4fdB3301693606e9D1ef1a92721896EED9](https://testnet.monadexplorer.com/address/0x5e70Ae4fdB3301693606e9D1ef1a92721896EED9)
- `ParallaxTaskManager`: [0x7371e2777cD7Cbf9d3bE33F780122C1C9C9A4F20](https://testnet.monadexplorer.com/address/0x7371e2777cD7Cbf9d3bE33F780122C1C9C9A4F20)

## 🛠 Tech Stack
- **Smart Contracts:** Solidity, Hardhat, Ethers.js
- **Blockchain:** Monad Testnet
- **Backend:** Node.js, Express, Prisma (PostgreSQL), Gemini API
- **Frontend:** React, Vite, Tailwind CSS, DaisyUI

## 🚀 How to Setup (Local Development)

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
# Deploy to monadTestnet
npx hardhat run scripts/deploy.ts --network monadTestnet
```

### 2. Backend
Create a `.env` file from `.env.example` and add your database URL, Gemini API Key, Monad RPC URL, and the Orchestrator's Private Key.
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### 3. Frontend
Create a `.env` file and add `VITE_API_URL=http://localhost:3000`.
```bash
cd frontend
npm install
npm run dev
```

## 🔮 What's Next?
- **Decentralized Deliverable Storage:** Worker submissions are currently persisted server-side; pinning them to IPFS alongside task specs and datasets.
- **Policy Layer Before Payout:** Bounding what the Orchestrator key can auto-approve, and escalating high-value releases to the customer.
- **ZK Proof Verification:** Transitioning from an AI Orchestrator wallet to Zero-Knowledge coprocessors for mathematically provable off-chain compute verification.

---
*Built for the Monad Hackathon.*

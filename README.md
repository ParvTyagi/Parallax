<div align="center">
  <img src="https://i.imgur.com/B707rZ5.png" alt="Parallax Logo" width="200" height="200" />
  <h1>Parallax</h1>
  <p><strong>The Decentralized AI-Assisted Compute Network on Monad</strong></p>
  <p>Parallax turns one massive customer job into independently claimable microtasks. Workers complete different pieces simultaneously, an AI orchestrator verifies them, and the corresponding reward is released instantly on the Monad blockchain.</p>
</div>

<br/>

> **The unit of work becomes the unit of payment.**

---

## 🏆 Overview

Current decentralized compute networks treat processing as a single monolithic block. Parallax leverages **Monad's parallel execution capabilities** by breaking down massive tasks—like dataset processing, market research, or code refactoring—into granular, independent microtasks. 

Instead of waiting for an entire job to finish, global workers can claim individual chunks. As soon as a chunk is completed and verified by our **AI Orchestrator (Gemini)**, the smart contract settles the payment trustlessly on-chain in sub-seconds. Once all chunks are finished, the AI synthesizes a final master solution.

## ✨ Features

- 🧠 **AI Decomposition**: Customers input a large task; the AI Orchestrator intelligently slices it into digestible subtasks.
- ⏱️ **Dynamic Leases**: The AI analyzes task complexity and assigns dynamic lease durations (e.g., 5 mins vs 30 mins). If a worker doesn't submit in time, the claim is dropped and returned to the pool.
- 🛡️ **Trustless Verification**: Worker submissions are hashed and recorded on-chain. The AI Orchestrator verifies the off-chain data against the on-chain hash. If approved, funds are released.
- 🧩 **Automated Master Aggregation**: When all subtasks reach `VERIFIED` status, the AI seamlessly merges disjointed worker outputs into a cohesive final solution for the customer.
- ⚡ **Sub-Second Settlement**: Powered by the Monad Testnet for zero-friction micropayments.

## 🛠 Tech Stack

- **Smart Contracts:** Solidity, Hardhat, Ethers.js
- **Blockchain:** Monad Testnet
- **Backend:** Node.js, Express, Prisma (PostgreSQL), Gemini-3.5-flash-lite SDK
- **Frontend:** React, Vite, Tailwind CSS, DaisyUI, ethers.js v6

## 🌐 Live Links

- **Frontend Application:** *[Vercel URL - To Be Deployed]*
- **Backend API:** [https://parallax-8yob.onrender.com](https://parallax-8yob.onrender.com)
- **Deployed Contracts (Monad Testnet):**
  - `ParallaxEscrow`: `0xc46EdBfBf0433c9C7a0d508cd8a97aEC0B24C713`
  - `ParallaxTaskManager`: `0x79430B85C3c5d762FbBF178DbADaF7981798C412`

## 🚀 Running Locally

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
# Deploy to monadTestnet
npx hardhat run scripts/deploy.ts --network monadTestnet
```

### 2. Backend
Create a `.env` file from `.env.example` and add your database, Gemini API, and Orchestrator Private Key.
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
- **IPFS Codebase Processing:** Allowing customers to upload `.zip` codebases to IPFS so the network can perform decentralized code reviews and refactors.
- **ZK Proof Verification:** Transitioning from an AI Orchestrator wallet to Zero-Knowledge coprocessors for mathematically provable off-chain compute verification.

---
*Built for the Monad Hackathon.*

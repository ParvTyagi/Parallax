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

1. **AI Decomposition:** Customers input a large task; the AI Orchestrator intelligently slices it into independent subtasks.
2. **Parallel Execution:** Global workers claim individual chunks simultaneously, dramatically speeding up completion time.
3. **Dynamic Leases:** The AI analyzes task complexity and assigns dynamic lease durations. If a worker doesn't submit in time, the claim is dropped and returned to the pool.
4. **Trustless AI Verification:** Worker submissions are hashed on-chain. Our AI Orchestrator acts as a decentralized QA node, evaluating the off-chain data against the task requirements. If approved, funds are released trustlessly.
5. **Automated Master Aggregation:** When all subtasks reach `VERIFIED` status, the AI seamlessly merges the disjointed worker outputs into one cohesive final solution for the customer.

## 🌐 Live Links

- **Frontend Application (Vercel):** [https://parallax-mu-sand.vercel.app/](https://parallax-mu-sand.vercel.app/)
- **Backend API (Render):** [https://parallax-8yob.onrender.com](https://parallax-8yob.onrender.com)

### Smart Contracts (Monad Testnet)
- `ParallaxEscrow`: `0x04AF0d04E5D4895Aca4763185b95BaCf54c26069`
- `ParallaxTaskManager`: `0x8a50d0208c719cBB92094f3A18A072Ce37cad974`

## 🛠 Tech Stack
- **Smart Contracts:** Solidity, Hardhat, Ethers.js
- **Blockchain:** Monad Testnet
- **Backend:** Node.js, Express, Prisma (PostgreSQL), Gemini-3.5-flash-lite SDK
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
- **IPFS Codebase Processing:** Allowing customers to upload `.zip` codebases to IPFS so the network can perform decentralized code reviews and large-scale refactoring.
- **ZK Proof Verification:** Transitioning from an AI Orchestrator wallet to Zero-Knowledge coprocessors for mathematically provable off-chain compute verification.

---
*Built for the Monad Hackathon.*

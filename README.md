# Parallax Monad Hackathon MVP

Parallax turns one large customer job into independently claimable microtasks. Workers complete different pieces simultaneously, each result is verified by an AI orchestrator, and the corresponding reward is released immediately on Monad.

> **The unit of work becomes the unit of payment.**

## Live Demo Links
- **Live URL:** [TBD]
- **Contracts on Monad Testnet:**
  - `ParallaxEscrow`: `0x8E298092905e63477754ADaA23D47ceE54374667`
  - `ParallaxTaskManager`: `0xffD7F15736c6a5232336A8fAB285ba005a49aCED`

## Requirements to Run
1. Node.js v24+
2. MetaMask with Monad Testnet configured
3. A `.env` file copied from `.env.example` with your Gemini API key and Monad RPC URL.

## Local Setup

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat test
```

### 2. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Hackathon Constraints
- Verification is done via a trusted AI orchestrator wallet (disclosed design).
- Data aggregation of final results is deterministic off-chain.
- The system heavily leverages Monad's parallel execution state model where each worker acts on independent task states to avoid global state contention.

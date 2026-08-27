import { useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ParallaxLogo, ParallaxMark } from "../components/ui/ParallaxLogo";
import {
  ArrowRight,
  Shield,
  Cpu,
  Coins,
  Users,
  Zap,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface DemoScenario {
  id: string;
  title: string;
  category: string;
  budget: string;
  prompt: string;
  subtasks: {
    title: string;
    reward: string;
    worker: string;
    state: "VERIFIED" | "IN_REVIEW" | "CLAIMED";
    score: number;
  }[];
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "defi",
    title: "DeFi Protocol Research",
    category: "RESEARCH",
    budget: "12.00 MON",
    prompt: "Evaluate top 5 liquid staking protocols on Monad, compare fee structures, audit histories, and synthesize an executive report in Markdown.",
    subtasks: [
      {
        title: "Protocol TVL & Yield Analysis",
        reward: "4.00 MON",
        worker: "0x82f…94a",
        state: "VERIFIED",
        score: 96,
      },
      {
        title: "Smart Contract Architecture & Slashing Review",
        reward: "4.00 MON",
        worker: "0x4a1…31c",
        state: "VERIFIED",
        score: 94,
      },
      {
        title: "Executive Synthesis & Risk Matrix",
        reward: "4.00 MON",
        worker: "0x9b3…78e",
        state: "VERIFIED",
        score: 98,
      },
    ],
  },
  {
    id: "audit",
    title: "Smart Contract Security Review",
    category: "DEV",
    budget: "24.00 MON",
    prompt: "Perform formal verification, static analysis with Slither, and unit test edge cases for an automated liquidity manager contract.",
    subtasks: [
      {
        title: "Static Slither & Mythril Analysis",
        reward: "8.00 MON",
        worker: "0x71a…20f",
        state: "VERIFIED",
        score: 97,
      },
      {
        title: "Reentrancy & Invariant Fuzz Testing",
        reward: "8.00 MON",
        worker: "0x53d…99b",
        state: "VERIFIED",
        score: 95,
      },
      {
        title: "Remediation Report & Recommendations",
        reward: "8.00 MON",
        worker: "0x32c…14a",
        state: "VERIFIED",
        score: 99,
      },
    ],
  },
  {
    id: "ai",
    title: "Multimodal AI Dataset Annotation",
    category: "DATA",
    budget: "15.00 MON",
    prompt: "Label 500 edge-case UI screenshots with bounding boxes, interaction intent classifications, and accessibility accessibility tags.",
    subtasks: [
      {
        title: "Bounding Box & Semantic Segmentation",
        reward: "5.00 MON",
        worker: "0x19f…44d",
        state: "VERIFIED",
        score: 93,
      },
      {
        title: "Interaction Intent Schema Tagging",
        reward: "5.00 MON",
        worker: "0x66e…82a",
        state: "VERIFIED",
        score: 96,
      },
      {
        title: "Quality Control & Schema Normalization",
        reward: "5.00 MON",
        worker: "0x28a…77f",
        state: "VERIFIED",
        score: 98,
      },
    ],
  },
];

export default function LandingPage() {
  const { account, connectWallet, isConnecting } = useWeb3();
  const [selectedDemo, setSelectedDemo] = useState<DemoScenario>(DEMO_SCENARIOS[0]);

  return (
    <div data-theme="parallax-dark" className="min-h-screen bg-base-100 text-base-content font-sans antialiased overflow-x-hidden selection:bg-primary/20">
      {/* ─── Navbar ─── */}
      <header className="navbar fixed top-0 z-50 bg-base-100/80 backdrop-blur-xl border-b border-base-300/40 px-6 md:px-12 min-h-16 justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <ParallaxLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-base-content/60">
            <a href="#demo" className="hover:text-base-content transition-colors">
              Interactive Demo
            </a>
            <a href="#how-it-works" className="hover:text-base-content transition-colors">
              How It Works
            </a>
            <a href="#comparison" className="hover:text-base-content transition-colors">
              Comparison
            </a>
            <a href="#features" className="hover:text-base-content transition-colors">
              Features
            </a>
            <Link to="/security" className="hover:text-base-content transition-colors">
              Security
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {account ? (
            <Link to="/app" className="btn btn-neutral btn-sm font-bold text-xs gap-1.5 shadow-xs">
              <span>Enter Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="btn btn-neutral btn-sm font-bold text-xs gap-1.5 shadow-xs"
            >
              {isConnecting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <span>Connect Wallet</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 md:pt-40 pb-16 px-6 md:px-12 max-w-6xl mx-auto text-center">
        {/* Subtle Ambient Backdrops */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-secondary/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-[350px] h-[250px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-4xl mx-auto">
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2 bg-base-200/90 border border-base-300/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-base-content/80 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span>Live on Monad Testnet</span>
            <span className="text-base-content/30">•</span>
            <span className="text-accent font-mono text-[11px]">AI Orchestration Protocol</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-base-content">
            AI Splits the Work.
            <br />
            <span className="bg-gradient-to-r from-accent via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Blockchain Pays.
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-base-content/60 max-w-2xl mx-auto font-normal leading-relaxed">
            Parallax turns ambitious project prompts into discrete, verifiable microtasks. Gemini AI evaluates submissions automatically while smart contracts handle instant escrow releases.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            {account ? (
              <Link to="/app" className="btn btn-neutral btn-md font-bold text-sm px-8 gap-2 shadow-xs">
                <span>Enter Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="btn btn-neutral btn-md font-bold text-sm px-8 gap-2 shadow-xs"
              >
                {isConnecting ? <span className="loading loading-spinner loading-sm" /> : "Get Started on Testnet"}
                {!isConnecting && <ArrowRight className="w-4 h-4" />}
              </button>
            )}
            <Link
              to="/worker"
              className="btn btn-outline border-base-300/80 btn-md text-sm font-semibold text-base-content/80 hover:bg-base-200 px-6"
            >
              Browse Open Bounties
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Interactive Live Simulator Demo ─── */}
      <section id="demo" className="py-12 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="card bg-base-200/70 border border-base-300/80 shadow-xl overflow-hidden">
          {/* Simulator Header */}
          <div className="border-b border-base-300/80 p-4 md:p-6 bg-base-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-error/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="text-xs font-mono text-base-content/50 ml-2">
                parallax-orchestrator // live sandbox
              </span>
            </div>

            {/* Scenario Switcher Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-base-300/40 p-1 rounded-xl">
              {DEMO_SCENARIOS.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => setSelectedDemo(demo)}
                  className={`btn btn-xs rounded-lg font-medium text-xs transition-all ${
                    selectedDemo.id === demo.id
                      ? "btn-neutral shadow-xs"
                      : "btn-ghost text-base-content/60"
                  }`}
                >
                  {demo.title}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Content */}
          <div className="card-body p-6 md:p-8 space-y-6">
            {/* Master Task Prompt Box */}
            <div className="p-5 rounded-2xl bg-base-100/80 border border-base-300 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-neutral font-mono text-[10px] uppercase font-bold">
                    MASTER TASK
                  </span>
                  <span className="badge badge-accent badge-outline text-[10px] font-mono font-bold">
                    #{selectedDemo.category}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-base-content">
                  Total Budget: <span className="text-accent">{selectedDemo.budget}</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-base-content leading-relaxed">
                "{selectedDemo.prompt}"
              </p>
            </div>

            {/* Decomposed Subtask Execution Pipeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-base-content/60">
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  Gemini 3.7 Autonomous Decomposition ({selectedDemo.subtasks.length} Subtasks)
                </span>
                <span className="text-success font-mono font-semibold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified on Monad
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedDemo.subtasks.map((st, index) => (
                  <div
                    key={st.title}
                    className="p-4 rounded-xl bg-base-100/60 border border-base-300/80 hover:border-base-content/30 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-base-content/40 uppercase">
                        Phase 0{index + 1}
                      </span>
                      <span className="badge badge-success badge-xs font-mono font-bold">
                        VERIFIED
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-base-content leading-snug line-clamp-2">
                      {st.title}
                    </h4>

                    <div className="pt-2 border-t border-base-300/60 space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between text-base-content/60">
                        <span>Worker:</span>
                        <span className="text-base-content font-medium">{st.worker}</span>
                      </div>
                      <div className="flex justify-between text-base-content/60">
                        <span>AI Grade:</span>
                        <span className="text-success font-bold">{st.score}/100</span>
                      </div>
                      <div className="flex justify-between text-base-content/60">
                        <span>Payout:</span>
                        <span className="text-accent font-bold">+{st.reward}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Metric Highlights ─── */}
      <section className="border-y border-base-300/40 bg-base-200/40 py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">Autonomous</div>
            <div className="text-xs text-base-content/50 font-medium mt-1">AI Task Decomposition</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-success">95%</div>
            <div className="text-xs text-base-content/50 font-medium mt-1">Direct Worker Earnings</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-accent">Gemini 3.7</div>
            <div className="text-xs text-base-content/50 font-medium mt-1">Automated Quality Scoring</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">Instant</div>
            <div className="text-xs text-base-content/50 font-medium mt-1">Smart Contract Escrow</div>
          </div>
        </div>
      </section>

      {/* ─── How It Works (3 Steps) ─── */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-base-content">
            How Parallax Works
          </h2>
          <p className="text-sm text-base-content/60">
            A zero-trust execution pipeline from prompt to on-chain settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-base-200/50 border border-base-300/60 shadow-xs hover:border-base-content/30 transition-colors">
            <div className="card-body p-6 gap-4">
              <div className="w-10 h-10 rounded-xl bg-base-300/80 border border-base-300 flex items-center justify-center font-mono font-bold text-sm text-accent">
                01
              </div>
              <h3 className="text-base font-bold text-base-content">Submit & Decompose</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Describe your project and fund the escrow. Gemini AI decomposes it into 3-5 independently workable microtasks and pins the specs to IPFS.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/50 border border-base-300/60 shadow-xs hover:border-base-content/30 transition-colors">
            <div className="card-body p-6 gap-4">
              <div className="w-10 h-10 rounded-xl bg-base-300/80 border border-base-300 flex items-center justify-center font-mono font-bold text-sm text-secondary">
                02
              </div>
              <h3 className="text-base font-bold text-base-content">Stake & Deliver</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Qualified workers stake MON collateral to claim subtasks. They submit finished deliverables pinned to IPFS, ensuring complete tamper-proof transparency.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/50 border border-base-300/60 shadow-xs hover:border-base-content/30 transition-colors">
            <div className="card-body p-6 gap-4">
              <div className="w-10 h-10 rounded-xl bg-base-300/80 border border-base-300 flex items-center justify-center font-mono font-bold text-sm text-success">
                03
              </div>
              <h3 className="text-base font-bold text-base-content">Verify & Settle</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                The AI Orchestrator grades work against master specs. Passed submissions trigger instant smart contract payouts; invalid work results in slashed stakes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Platform Comparison: Parallax vs Legacy Freelance ─── */}
      <section id="comparison" className="py-20 px-6 md:px-12 bg-base-200/30 border-y border-base-300/40">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">
              Market Disruption
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-base-content">
              Why Parallax Outperforms Legacy Platforms
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-md w-full bg-base-200/60 rounded-2xl border border-base-300 shadow-sm">
              <thead>
                <tr className="border-b border-base-300 text-base-content/50 text-[11px] uppercase tracking-wider">
                  <th className="py-4">Feature</th>
                  <th className="py-4 text-base-content font-bold">Parallax Network</th>
                  <th className="py-4">Legacy Platforms (Upwork, Fiverr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300/60 text-xs">
                <tr>
                  <td className="font-bold text-base-content py-4">Platform Take Rate</td>
                  <td className="py-4 font-mono font-bold text-success">5.0% flat fee</td>
                  <td className="py-4 text-base-content/50">20.0% – 30.0% fee</td>
                </tr>
                <tr>
                  <td className="font-bold text-base-content py-4">Payout Settlement Speed</td>
                  <td className="py-4 font-mono font-bold text-success">Instant on verification</td>
                  <td className="py-4 text-base-content/50">14-day mandatory hold</td>
                </tr>
                <tr>
                  <td className="font-bold text-base-content py-4">Task Decomposition</td>
                  <td className="py-4 font-mono font-bold text-success">Autonomous Gemini 3.7 AI</td>
                  <td className="py-4 text-base-content/50">Manual manual scoping</td>
                </tr>
                <tr>
                  <td className="font-bold text-base-content py-4">Dispute & QA Mechanism</td>
                  <td className="py-4 font-mono font-bold text-success">Deterministic AI scoring + Stake Slashing</td>
                  <td className="py-4 text-base-content/50">Subjective customer support tickets</td>
                </tr>
                <tr>
                  <td className="font-bold text-base-content py-4">Custody & Transparency</td>
                  <td className="py-4 font-mono font-bold text-success">100% Non-Custodial Smart Contracts</td>
                  <td className="py-4 text-base-content/50">Centralized corporate bank accounts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Feature Grid ─── */}
      <section id="features" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-base-content">
            Built for High-Trust Microtasking
          </h2>
          <p className="text-sm text-base-content/60">
            A cohesive stack designed for reliable execution, economic security, and automated payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Cpu className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-base-content">AI Task Decomposition</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Gemini AI parses large requirements and splits them into distinct, independently manageable micro-deliverables.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Shield className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-base-content">Staking & Quality Assurance</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Workers stake MON collateral to claim tasks. Incomplete or poor quality work results in stake slashing.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Lock className="w-5 h-5 text-secondary" />
              <h3 className="text-sm font-bold text-base-content">Non-Custodial Escrows</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Customer funds are held transparently in smart contracts and only unlocked upon verified completion.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Coins className="w-5 h-5 text-success" />
              <h3 className="text-sm font-bold text-base-content">Instant Settlement</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Immediate on-chain releases ensure freelancers are paid directly upon approval with no 14-day delays.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Users className="w-5 h-5 text-info" />
              <h3 className="text-sm font-bold text-base-content">On-Chain Reputation</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Immutable reputation scores allow clients to restrict critical jobs to top-tier proven workers.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/40 border border-base-300/60 shadow-xs">
            <div className="card-body p-5 gap-3">
              <Zap className="w-5 h-5 text-warning" />
              <h3 className="text-sm font-bold text-base-content">IPFS Artifact Storage</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Task descriptions, spec sheets, and final deliverables are pinned permanently to IPFS for verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer CTA ─── */}
      <section className="py-20 px-6 md:px-12 text-center max-w-4xl mx-auto space-y-6">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-base-content">
          Ready to coordinate decentralized intelligence?
        </h2>
        <p className="text-sm md:text-base text-base-content/60 max-w-xl mx-auto">
          Post your first project or claim an active bounty on the Monad testnet today.
        </p>
        <div className="pt-2">
          {account ? (
            <Link to="/app" className="btn btn-neutral btn-md font-bold text-sm px-8 gap-2 shadow-xs">
              <span>Open Parallax App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="btn btn-neutral btn-md font-bold text-sm px-8 gap-2 shadow-xs"
            >
              {isConnecting ? <span className="loading loading-spinner loading-sm" /> : "Connect Wallet & Launch"}
            </button>
          )}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-base-300/40 py-10 px-6 md:px-12 text-xs text-base-content/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ParallaxMark className="w-5 h-5" />
            <span className="font-bold text-base-content">Parallax Protocol</span>
            <span className="text-[10px] text-base-content/40 font-mono">v1.0 (Monad Testnet)</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/security" className="hover:text-base-content transition-colors">
              Security & Transparency
            </Link>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-base-content transition-colors flex items-center gap-1"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <span>© 2026 Parallax Protocol. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}





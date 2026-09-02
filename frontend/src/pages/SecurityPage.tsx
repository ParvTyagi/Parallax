import { Link } from "react-router-dom";
import { ParallaxLogo, ParallaxMark } from "../components/ui/ParallaxLogo";
import {
  ShieldCheck,
  Lock,
  Cpu,
  Coins,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  FileCheck,
} from "lucide-react";

export default function SecurityPage() {
  return (
    <div data-theme="parallax-dark" className="min-h-screen bg-base-100 text-base-content font-sans antialiased pb-20 selection:bg-primary/20">
      {/* ─── Sticky Navbar ─── */}
      <header className="navbar sticky top-0 z-50 bg-base-100/80 backdrop-blur-xl border-b border-base-300/40 px-6 md:px-12 min-h-16 justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <ParallaxLogo />
        </Link>
        <Link
          to="/"
          className="btn btn-ghost btn-sm text-xs font-semibold text-base-content/60 hover:text-base-content gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-12 md:pt-16 space-y-12">
        {/* ─── Header ─── */}
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-success/10 border border-success/20 text-success text-xs font-bold px-3.5 py-1 rounded-full font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURITY &amp; TRUST ARCHITECTURE</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-base-content">
            Enterprise Security &amp; Non-Custodial Assurance
          </h1>

          <p className="text-sm md:text-base text-base-content/60 leading-relaxed">
            Parallax eliminates counterparty risk and subjective payment disputes by coupling smart contract escrows with objective, automated AI verification.
          </p>
        </div>

        {/* ─── Security Pillars ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pillar 1: Non-Custodial Escrow */}
          <div className="card bg-base-200/50 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Non-Custodial Smart Contract Escrows</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Client funds are held in transparent, on-chain smart contract escrows on Monad. No centralized entity can freeze, withhold, or misuse deposited capital. Funds unlock only when milestone requirements are satisfied.
              </p>
            </div>
          </div>

          {/* Pillar 2: AI Objective Verification */}
          <div className="card bg-base-200/50 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Deterministic AI Verification</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Deliverables are automatically evaluated by Gemini AI models against the explicit requirements established during task creation. This eliminates subjective dispute delays and ensures uniform quality control.
              </p>
            </div>
          </div>

          {/* Pillar 3: Staking & Economic Security */}
          <div className="card bg-base-200/50 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Economic Collateral &amp; Staking</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                Freelancers stake collateral when claiming tasks. This economic skin-in-the-game guarantees commitment, disincentivizes spam, and penalizes abandoned or substandard deliverables.
              </p>
            </div>
          </div>

          {/* Pillar 4: IPFS Decentralized Provenance */}
          <div className="card bg-base-200/50 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-base-content">Immutable Artifact Provenance</h3>
              <p className="text-xs text-base-content/60 leading-relaxed">
                All specifications, datasets, and submitted work deliverables are content-addressed and pinned to IPFS nodes. This guarantees permanent, tamper-evident proof of delivery accessible anytime.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Bug Bounty & Responsible Disclosure ─── */}
        <div className="card bg-neutral text-neutral-content shadow-md">
          <div className="card-body p-8 text-center space-y-4 max-w-xl mx-auto">
            <ShieldCheck className="w-10 h-10 text-accent mx-auto" />
            <h3 className="text-xl font-bold text-neutral-content">
              Continuous Auditing &amp; Responsible Disclosure
            </h3>
            <p className="text-xs text-neutral-content/70 leading-relaxed">
              We maintain an active security review process and reward whitehat security researchers who responsibly report vulnerabilities across our testnet protocol and infrastructure.
            </p>
            <div className="pt-2">
              <a
                href="mailto:security@parallax.network"
                className="btn btn-primary btn-sm font-bold text-xs gap-1.5"
              >
                <span>Contact Security Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-base-300/40 mt-16 py-8 px-6 text-xs text-base-content/60">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ParallaxMark className="w-4 h-4" />
            <span>© 2026 Parallax Protocol. Security &amp; Trust Architecture.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-base-content transition-colors">Home</Link>
            <Link to="/app" className="hover:text-base-content transition-colors">Workspace</Link>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-base-content transition-colors flex items-center gap-1"
            >
              <span>Monad Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}



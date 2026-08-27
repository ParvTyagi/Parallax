import { Link } from "react-router-dom";
import { ParallaxLogo, ParallaxMark } from "../components/ui/ParallaxLogo";
import {
  ShieldAlert,
  Lock,
  Server,
  Bug,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
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
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-warning/10 border border-warning/20 text-warning text-xs font-bold px-3 py-1 rounded-full font-mono">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>TRANSPARENCY REPORT &amp; SECURITY MODEL</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-base-content">
            Security Architecture &amp; Disclosures
          </h1>

          <p className="text-sm md:text-base text-base-content/60 leading-relaxed max-w-3xl">
            We believe in complete cryptographic transparency. While Parallax v1.0 implements robust on-chain staking and escrow mechanics on Monad Testnet, here is an honest assessment of current design trade-offs, trust vectors, and our decentralized mitigation roadmap.
          </p>
        </div>

        {/* ─── Vulnerability / Architecture Cards ─── */}
        <div className="space-y-6">
          {/* Card 1: Centralized Key */}
          <div className="card bg-base-200/50 border border-error/30 shadow-xs">
            <div className="card-body p-6 md:p-8 gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="badge badge-error badge-xs font-mono font-bold">CRITICAL</span>
                      <span className="text-[11px] font-mono text-base-content/50 uppercase">Vector #01</span>
                    </div>
                    <h2 className="text-lg font-bold text-base-content">
                      Centralized AI Orchestrator Signer
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-base-content/70 leading-relaxed">
                <p>
                  <strong className="text-base-content">Current Architecture:</strong> The Gemini AI evaluation agent runs on a centralized server holding the private key configured as the authorized verifier on <code className="font-mono bg-base-300 px-1 py-0.5 rounded text-accent">ParallaxTaskManager.sol</code>.
                </p>
                <p>
                  <strong className="text-base-content">Risk Profile:</strong> If the orchestrator server is compromised, an attacker could sign false verification payloads to release customer escrow balances.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-base-100/60 border border-base-300 space-y-1.5 text-xs">
                <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider block">
                  Mitigation Roadmap (Phase 2)
                </span>
                <p className="text-base-content/60 leading-relaxed">
                  Migrating AI verification workloads to <strong>Trusted Execution Environments (TEEs)</strong> using Phala Network dCAP attestations, followed by <strong>ZK-ML Coprocessors</strong> for verifiable zero-knowledge compute verified directly in EVM bytecode.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Public IPFS Data */}
          <div className="card bg-base-200/50 border border-warning/30 shadow-xs">
            <div className="card-body p-6 md:p-8 gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="badge badge-warning badge-xs font-mono font-bold">MEDIUM</span>
                      <span className="text-[11px] font-mono text-base-content/50 uppercase">Vector #02</span>
                    </div>
                    <h2 className="text-lg font-bold text-base-content">
                      Public IPFS Artifact Storage
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-base-content/70 leading-relaxed">
                <p>
                  <strong className="text-base-content">Current Architecture:</strong> Task specifications and deliverable files are pinned to public IPFS gateways via Pinata. Anyone with the CID can read the raw plaintext contents.
                </p>
                <p>
                  <strong className="text-base-content">Risk Profile:</strong> Highly sensitive enterprise IP or proprietary code cannot safely be posted to the public network without external client-side encryption.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-base-100/60 border border-base-300 space-y-1.5 text-xs">
                <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider block">
                  Mitigation Roadmap (Phase 2)
                </span>
                <p className="text-base-content/60 leading-relaxed">
                  Integration with <strong>Lit Protocol threshold encryption</strong>. Datasets are encrypted with condition-based access control; only workers who have staked MON and been awarded the lease can request threshold decryption shares.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Smart Contract Auditing */}
          <div className="card bg-base-200/50 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 md:p-8 gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-base-300/80 text-base-content/80 flex items-center justify-center shrink-0">
                    <Bug className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="badge badge-outline badge-xs font-mono font-bold">INFORMATIONAL</span>
                      <span className="text-[11px] font-mono text-base-content/50 uppercase">Vector #03</span>
                    </div>
                    <h2 className="text-lg font-bold text-base-content">
                      Pre-Audit Testnet Status
                    </h2>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-base-content/70 leading-relaxed">
                <p>
                  <strong className="text-base-content">Current Architecture:</strong> Contracts are deployed on Monad Testnet with full unit test suites and reentrancy protections, but have not yet undergone formal third-party audits.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-base-100/60 border border-base-300 space-y-1.5 text-xs">
                <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider block">
                  Mitigation Roadmap
                </span>
                <p className="text-base-content/60 leading-relaxed">
                  Third-party security audit engagement scheduled prior to Monad mainnet launch, accompanied by a public bug bounty pool on Code4rena.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bug Bounty CTA ─── */}
        <div className="card bg-neutral text-neutral-content shadow-md">
          <div className="card-body p-8 text-center space-y-4 max-w-xl mx-auto">
            <ShieldCheck className="w-10 h-10 text-accent mx-auto" />
            <h3 className="text-xl font-bold text-neutral-content">
              Responsible Disclosure &amp; Bug Bounty
            </h3>
            <p className="text-xs text-neutral-content/70 leading-relaxed">
              If you identify a security vulnerability in our testnet contracts or backend services, please practice responsible disclosure. We provide token rewards for actionable reports.
            </p>
            <div className="pt-2">
              <a
                href="mailto:security@parallax.network"
                className="btn btn-primary btn-sm font-bold text-xs gap-1.5"
              >
                <span>Report to Security Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-base-300/40 mt-16 py-8 px-6 text-xs text-base-content/50">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ParallaxMark className="w-4 h-4" />
            <span>© 2026 Parallax Protocol. Security Transparency.</span>
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
              <span>Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}


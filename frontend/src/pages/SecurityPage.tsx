import { PublicHeader } from "../components/layout/PublicHeader";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowLeft, LockKeyhole, ScanLine, Fingerprint, Wallet } from "lucide-react";
import { ParallaxLogo } from "../components/ui/ParallaxLogo";
import { BLOCK_EXPLORER_URL, TASK_MANAGER_ADDRESS, ESCROW_ADDRESS } from "../lib/constants";
export default function SecurityPage() {
  return <div data-theme="parallax" className="brand-site trust-page">
    <PublicHeader />
    <main id="main-content" tabIndex={-1} className="trust-main"><Link to="/" className="brand-text-link"><ArrowLeft size={15} />Back to home</Link><div className="trust-intro"><p className="eyebrow">Trust, made visible</p><h1>Understand the system.<br /><em>Make informed decisions.</em></h1><p>Parallax combines on-chain escrow with a centralized AI orchestrator. Here is what each part does, and where responsibility sits.</p></div>
    <div className="trust-grid">{[
      {icon:LockKeyhole,title:"On-chain escrow",text:"Project funds are held by the escrow contract. Contract rules govern payments, bonds, and eligible refunds. Funding and claiming require a wallet transaction."},
      {icon:ScanLine,title:"AI-assisted verification",text:"The centralized orchestrator assesses submissions against the task specification. It holds the signing key used to approve work. AI verdicts are not a guarantee of correctness."},
      {icon:Wallet,title:"Rewards and claim bonds",text:"A successful approval releases the reward and returns the worker’s bond. Failed verification holds the bond so the worker can appeal. An administrator decides whether to pay the worker or uphold rejection. Review the task’s criteria and claim deadline before committing."},
      {icon:Fingerprint,title:"Traceable activity",text:"Creation, claims, and approvals are recorded on-chain. The workspace indexes those events, so a transaction can be confirmed before its status appears in the interface."}
    ].map(({icon:Icon,title,text})=><article key={title}><Icon size={25} strokeWidth={1.5} /><h2>{title}</h2><p>{text}</p></article>)}</div>
    <section className="contract-register"><p className="eyebrow">Inspect the contracts</p><h2>Verify the details yourself.</h2>{[["Task manager",TASK_MANAGER_ADDRESS],["Escrow",ESCROW_ADDRESS]].map(([label,address])=><a key={label} href={`${BLOCK_EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer"><div><strong>{label}</strong><code>{address}</code></div><ArrowUpRight size={20} /></a>)}<p>New approvals pay immediately. Workers can appeal failed verification for administrator review.</p></section>
    </main><footer className="brand-footer"><ParallaxLogo /><span>Clear responsibilities. Visible progress.</span><Link to="/worker">Explore work <ArrowUpRight size={14} /></Link></footer>
  </div>;
}

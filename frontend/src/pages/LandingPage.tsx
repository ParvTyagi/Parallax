import { PublicHeader } from "../components/layout/PublicHeader";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, Check, Layers, ScanLine, Wallet } from "lucide-react";
import { ParallaxLogo, ParallaxMark } from "../components/ui/ParallaxLogo";
import { useWeb3 } from "../contexts/Web3Context";

export default function LandingPage() {
  const { networkName } = useWeb3();
  return <div data-theme="parallax" className="brand-site">
    <PublicHeader />
    <main id="main-content" tabIndex={-1}>
      <section className="brand-hero">
        <div className="hero-editorial"><p className="brand-kicker"><span />Independent work. Shared progress.</p><h1>Big ideas.<br />Focused work.<br /><em>Real outcomes.</em></h1><p className="hero-description">A workspace for turning ambitious projects into clear, independent tasks. Set the direction, bring in contributors, and follow every deliverable.</p><div className="hero-actions"><Link to="/creator/new" className="brand-button">Start a project <ArrowUpRight size={18} /></Link><Link to="/worker" className="brand-text-link">Find your next task <ArrowRight size={17} /></Link></div><div className="hero-caption"><span className="network-dot" />{networkName || "Monad Testnet"}<span className="caption-separator">/</span>Wallet-connected workspace</div></div>
        <div className="hero-workboard" aria-label="Illustrative project workflow">
          <div className="workboard-top"><ParallaxMark className="w-7 h-7" /><span>FROM IDEA TO IMPACT</span><span className="workboard-example">Example</span></div>
          <div className="workboard-project"><span className="eyebrow">Project brief</span><h2>Make the complex<br />feel simple.</h2><p>One shared goal. Independent contributions.</p><div className="workboard-tags"><span>Research</span><span>Analysis</span><span>Delivery</span></div></div>
          <div className="workboard-flow"><div><span>01</span><p>Define the scope</p><Check size={15} /></div><div><span>02</span><p>Review the task plan</p><Check size={15} /></div><div className="flow-current"><span>03</span><p>Bring the work to life</p><ArrowUpRight size={15} /></div></div>
          <div className="workboard-bottom"><span className="orbit-mark" /><p>Individual expertise.<br /><strong>Collective progress.</strong></p></div>
        </div>
      </section>
      <div className="brand-principles"><span>Clear scope, from the start</span><i /><span>Independent contributions</span><i /><span>Visible verification</span><i /><span>On-chain payments</span></div>
      <section id="process" className="brand-section"><div className="section-heading"><div><p className="eyebrow">The process / 01</p><h2>A better way to<br />move work forward.</h2></div><p>Structure before execution. Visibility at every step.<br />A clear destination for every contribution.</p></div><div className="process-grid">{[
        {n:"01",icon:Layers,title:"Scope it with intention.",body:"Describe the outcome and set a budget. AI proposes independent tasks with concrete acceptance criteria."},
        {n:"02",icon:ScanLine,title:"Make every task count.",body:"Review the plan before funding. Contributors choose work that fits their skills and submit against the agreed criteria."},
        {n:"03",icon:Wallet,title:"Close the loop.",body:"The orchestrator verifies submissions. Successful approval releases the reward and returns the worker’s claim bond."}
      ].map(({n,icon:Icon,title,body})=><article key={n}><div><span>{n}</span><Icon size={24} strokeWidth={1.4} /></div><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="brand-dual"><article><p className="eyebrow">For project owners</p><h2>Your ambition.<br />A plan to deliver it.</h2><p>Define the work, review your budget allocation, and see where every task stands in one workspace.</p><Link to="/creator/new">Build your project <ArrowUpRight size={18} /></Link></article><article><p className="eyebrow">For contributors</p><h2>Your expertise.<br />Work worth doing.</h2><p>Find a focused task, understand the requirements and bond, and put your skills into a measurable deliverable.</p><Link to="/worker">Explore the marketplace <ArrowUpRight size={18} /></Link></article></section>
      <section className="brand-closing"><ParallaxMark className="w-12 h-12" /><h2>Great work starts<br />with a clear next step.</h2><Link to="/creator/dashboard" className="brand-button">Enter your workspace <ArrowUpRight size={18} /></Link></section>
    </main>
    <footer className="brand-footer"><ParallaxLogo /><span>Independent work. Shared progress.</span><Link to="/security">Trust & security <ArrowUpRight size={14} /></Link></footer>
  </div>;
}

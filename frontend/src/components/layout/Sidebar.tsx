import { Link } from "react-router-dom";
import { ParallaxLogo } from "../ui/ParallaxLogo";
import { useWeb3 } from "../../contexts/Web3Context";
import { WorkspaceLinks } from "./WorkspaceLinks";

export default function Sidebar() {
  const { networkName } = useWeb3();
  return <aside className="workspace-sidebar">
    <Link to="/" className="workspace-brand" aria-label="Parallax home"><ParallaxLogo /></Link>
    <div className="workspace-switcher"><span className="workspace-avatar">P</span><div><strong>Personal workspace</strong><span>Projects & contributions</span></div></div>
    <WorkspaceLinks />
    <div className="sidebar-note"><span className="eyebrow">A little focus goes a long way.</span><p>One clear brief.<br />Many possibilities.</p><Link to="/app">Create something <span aria-hidden="true">↗</span></Link></div>
    <div className="sidebar-network"><span className="network-dot" />{networkName || "Monad Testnet"}</div>
  </aside>;
}

import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Plus, Compass, UserCircle, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useWeb3 } from "../../contexts/Web3Context";
import { BLOCK_EXPLORER_URL } from "../../lib/constants";

export function WorkspaceLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { account } = useWeb3();
  const isAdmin = account?.toLowerCase() === "0xf302d2f179baf42d6f02e337b25cf882499b39e6";
  const links = [
    { to: "/creator/dashboard", label: "Overview", icon: LayoutDashboard, active: pathname === "/creator/dashboard" },
    { to: "/app", label: "Create a project", icon: Plus, active: ["/app", "/creator/new"].includes(pathname) },
    { to: "/worker", label: "Find work", icon: Compass, active: ["/worker", "/worker/explore"].includes(pathname) },
    ...(account ? [{ to: `/worker/${account}`, label: "My profile", icon: UserCircle, active: pathname.toLowerCase() === `/worker/${account.toLowerCase()}` }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Administration", icon: ShieldCheck, active: pathname === "/admin" }] : []),
  ];
  return <nav aria-label="Workspace" className="workspace-navigation">
    <p className="nav-caption">Workspace</p>
    {links.map(({ to, label, icon: Icon, active }) => <Link key={to} to={to} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`workspace-nav-link ${active ? "is-active" : ""}`}><Icon size={19} aria-hidden="true" /><span>{label}</span>{active && <span className="nav-active-dot" />}</Link>)}
    <p className="nav-caption mt-8">Resources</p>
    <Link to="/security" onClick={onNavigate} className="workspace-nav-link"><ShieldCheck size={19} aria-hidden="true" />Trust & security</Link>
    <a href={BLOCK_EXPLORER_URL} target="_blank" rel="noreferrer" className="workspace-nav-link"><ArrowUpRight size={19} aria-hidden="true" />Block explorer</a>
  </nav>;
}

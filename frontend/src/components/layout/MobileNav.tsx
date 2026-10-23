import { useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LogOut } from "lucide-react";
import { useWeb3 } from "../../contexts/Web3Context";
import { ParallaxLogo } from "../ui/ParallaxLogo";
import { WorkspaceLinks } from "./WorkspaceLinks";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { account, balance, connectWallet, disconnectWallet, isConnecting, networkName, currencySymbol } = useWeb3();
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <header className="mobile-topbar">
      <Link to="/" aria-label="Parallax home"><ParallaxLogo /></Link>
      <div className="flex items-center gap-2">
        {!account && <button onClick={connectWallet} disabled={isConnecting} className="btn btn-primary btn-sm">{isConnecting ? "Connecting…" : "Connect"}</button>}
        <Dialog.Trigger asChild><button className="btn btn-ghost btn-square" aria-label="Open navigation"><Menu size={22} /></button></Dialog.Trigger>
      </div>
    </header>
    <Dialog.Portal>
      <Dialog.Overlay className="navigation-overlay" />
      <Dialog.Content data-theme="parallax" className="mobile-navigation" aria-describedby="navigation-description">
        <div className="mobile-navigation-heading"><Dialog.Title><ParallaxLogo /></Dialog.Title><Dialog.Close asChild><button className="btn btn-ghost btn-square" aria-label="Close navigation"><X size={22} /></button></Dialog.Close></div>
        <p id="navigation-description" className="sr-only">Navigate your projects, contributions, and account.</p>
        <WorkspaceLinks onNavigate={() => setOpen(false)} />
        <div className="mobile-account"><p className="eyebrow">{networkName || "Monad Testnet"}</p>{account ? <><p className="font-mono break-all">{account}</p><strong>{balance ?? "—"} {currencySymbol || "MON"}</strong><button className="btn btn-outline w-full mt-4" onClick={() => { disconnectWallet(); setOpen(false); }}><LogOut size={16} />Disconnect wallet</button></> : <button onClick={connectWallet} disabled={isConnecting} className="btn btn-primary w-full mt-3">{isConnecting ? "Connecting…" : "Connect wallet"}</button>}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  PlusCircle,
  Compass,
  UserCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useWeb3 } from "../../contexts/Web3Context";
import { ParallaxLogo } from "../ui/ParallaxLogo";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { account, balance, connectWallet, isConnecting } = useWeb3();
  const isAdmin = account?.toLowerCase() === "0xf302d2f179baf42d6f02e337b25cf882499b39e6";

  const isActive = (path: string) => {
    if (path === "/app") return location.pathname === "/app";
    if (path === "/worker") return location.pathname === "/worker";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className="drawer drawer-end z-50">
        <input
          id="mobile-nav-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
        />

        {/* Top Mobile Bar */}
        <div className="drawer-content">
          <header className="navbar bg-base-100/90 backdrop-blur-md border-b border-base-300 sticky top-0 z-40 min-h-14 px-4 flex justify-between items-center">
            <Link to="/" onClick={() => setOpen(false)} className="shrink-0">
              <ParallaxLogo />
            </Link>

            <div className="flex items-center gap-2">
              {account ? (
                <div className="badge badge-sm badge-neutral font-mono text-[11px] py-2 px-2.5">
                  {account.slice(0, 6)}…{account.slice(-4)}
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="btn btn-xs btn-neutral font-semibold"
                >
                  {isConnecting ? <span className="loading loading-spinner loading-xs" /> : "Connect"}
                </button>
              )}

              <label
                htmlFor="mobile-nav-drawer"
                className="btn btn-square btn-ghost btn-sm text-base-content"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </label>
            </div>
          </header>
        </div>

        {/* Slide-out Drawer */}
        <div className="drawer-side">
          <label
            htmlFor="mobile-nav-drawer"
            aria-label="Close menu"
            className="drawer-overlay"
          />
          <div className="bg-base-100 min-h-full w-72 flex flex-col shadow-2xl border-l border-base-300">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-base-300">
              <ParallaxLogo />
              <button
                onClick={() => setOpen(false)}
                className="btn btn-square btn-ghost btn-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-base-content/40 uppercase block px-3 mb-2">
                  Client
                </span>
                <ul className="space-y-1">
                  <li>
                    <Link
                      to="/app"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive("/app")
                          ? "bg-neutral text-neutral-content font-semibold"
                          : "text-base-content/70 hover:bg-base-200"
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Post a Project</span>
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <span className="text-[10px] font-bold tracking-wider text-base-content/40 uppercase block px-3 mb-2">
                  Freelancer
                </span>
                <ul className="space-y-1">
                  <li>
                    <Link
                      to="/worker"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive("/worker") && !location.pathname.startsWith("/worker/0x")
                          ? "bg-neutral text-neutral-content font-semibold"
                          : "text-base-content/70 hover:bg-base-200"
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                      <span>Find Work</span>
                    </Link>
                  </li>
                  {account && (
                    <li>
                      <Link
                        to={`/worker/${account}`}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          location.pathname === `/worker/${account}`
                            ? "bg-neutral text-neutral-content font-semibold"
                            : "text-base-content/70 hover:bg-base-200"
                        }`}
                      >
                        <UserCircle className="w-4 h-4" />
                        <span>My Profile & Stakes</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              {isAdmin && (
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-warning uppercase block px-3 mb-2">
                    Admin
                  </span>
                  <ul className="space-y-1">
                    <li>
                      <Link
                        to="/admin"
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive("/admin")
                            ? "bg-neutral text-neutral-content font-semibold"
                            : "text-base-content/70 hover:bg-base-200"
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 text-warning" />
                        <span>Protocol Treasury</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold tracking-wider text-base-content/40 uppercase block px-3 mb-2">
                  Resources
                </span>
                <ul className="space-y-1">
                  <li>
                    <Link
                      to="/security"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Security & Trust</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-base-300 bg-base-200/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-base-content/70">
                  <span className="h-2 w-2 rounded-full bg-success inline-block" />
                  Monad Testnet
                </span>
                {balance && (
                  <span className="font-mono font-bold text-accent">{balance} MON</span>
                )}
              </div>
              {account && (
                <p className="text-[11px] font-mono text-base-content/40 truncate">
                  {account}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


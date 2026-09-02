import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useWeb3 } from "../../contexts/Web3Context";
import { Copy, Check, LogOut, ChevronDown, Wallet } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { account, balance, connectWallet, disconnectWallet, isConnecting } = useWeb3();
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPageTitle = () => {
    if (location.pathname === "/app") return "Post a Project";
    if (location.pathname === "/worker") return "Freelancer Marketplace";
    if (location.pathname.startsWith("/worker/")) return "Worker Profile";
    if (location.pathname.startsWith("/task/")) return "Task Execution Graph";
    if (location.pathname === "/admin") return "Protocol Treasury";
    return "Dashboard";
  };

  return (
    <div data-theme="parallax" className="min-h-screen bg-base-200 flex text-base-content antialiased">
      {/* Lets a keyboard user reach the page without tabbing the whole sidebar. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-neutral focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-neutral-content focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Desktop Top Bar ─── */}
        <header className="navbar hidden md:flex bg-base-100/90 backdrop-blur-md border-b border-base-300 sticky top-0 z-30 px-8 min-h-16 justify-between">
          <nav aria-label="Breadcrumb" className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <span className="font-semibold text-base-content/80">Parallax</span>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-base-content font-medium">
                {getPageTitle()}
              </span>
            </div>
          </nav>

          <div className="flex items-center gap-3">
            {/* Live Network Badge */}
            <div className="inline-flex items-center gap-2 bg-base-200 border border-base-300/80 px-3 py-1.5 rounded-lg text-xs font-semibold text-base-content/80">
              <span className="relative flex h-2 w-2">
                <span
                  aria-hidden="true"
                  className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
                />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span>Monad Testnet</span>
            </div>

            {/* Wallet Balance & Account Button */}
            {account ? (
              <div className="dropdown dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  aria-haspopup="menu"
                  aria-label={`Wallet menu for ${account.slice(0, 6)}…${account.slice(-4)}`}
                  className="flex items-center gap-2.5 bg-base-100 hover:bg-base-200 border border-base-300/90 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {balance !== null && (
                    <span className="text-xs font-mono font-bold text-base-content border-r border-base-300 pr-2.5">
                      {balance} MON
                    </span>
                  )}
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 shrink-0" />
                  <span className="text-xs font-mono font-medium text-base-content">
                    {account.slice(0, 6)}…{account.slice(-4)}
                  </span>
                  <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-base-content/60" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu p-2 shadow-xl bg-base-100 border border-base-300 rounded-xl w-56 mt-2 text-xs space-y-1 z-50"
                >
                  <li className="menu-title px-2 py-1 text-[10px] uppercase font-bold text-base-content/60 tracking-wider">
                    Connected Wallet
                  </li>
                  <li>
                    <button onClick={copyAddress} className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2">
                        {copied ? (
                          <Check aria-hidden="true" className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy aria-hidden="true" className="w-3.5 h-3.5" />
                        )}
                        {copied ? "Copied address" : "Copy Address"}
                      </span>
                    </button>
                  </li>
                  <li>
                    <Link to={`/worker/${account}`} className="py-2">
                      View My Profile
                    </Link>
                  </li>
                  <div className="divider my-1 opacity-40" />
                  <li>
                    <button
                      onClick={disconnectWallet}
                      className="text-error hover:bg-error/10 flex items-center gap-2 py-2 font-medium"
                    >
                      <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="btn btn-neutral btn-sm font-semibold gap-2 shadow-xs"
              >
                {isConnecting ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : (
                  <Wallet aria-hidden="true" className="w-3.5 h-3.5" />
                )}
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {/* ─── Mobile top bar ─── */}
        <div className="block md:hidden">
          <MobileNav />
        </div>

        {/* ─── Main Viewport Content ─── */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-5 md:p-8 lg:p-10 overflow-y-auto focus:outline-none">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Wallet address copied to clipboard" : ""}
      </span>
    </div>
  );
}




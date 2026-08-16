import React from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useWeb3 } from "../../contexts/Web3Context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { account, connectWallet, isConnecting } = useWeb3();

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col md:flex-row font-sans text-gray-900 selection:bg-black selection:text-white">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Header & Nav */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar with Wallet Status (Desktop only, mobile has it in header) */}
        <header className="hidden md:flex h-16 border-b border-gray-100 bg-white/50 backdrop-blur-xl items-center justify-end px-8 sticky top-0 z-20">
          
          <div className="flex items-center gap-4">
            {/* Network Status */}
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-100/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Monad Testnet
            </div>

            {/* Wallet Connection */}
            {account ? (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-emerald-500" />
                <span className="text-sm font-mono font-medium text-gray-700">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="text-sm font-semibold bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-6 md:p-10 w-full animate-in fade-in duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

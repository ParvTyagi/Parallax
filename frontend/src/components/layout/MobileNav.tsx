import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, Code2, LayoutDashboard, Briefcase } from "lucide-react";
import { useWeb3 } from "../../contexts/Web3Context";
import { cn } from "../../lib/utils";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { account, connectWallet, isConnecting } = useWeb3();

  const closeMenu = () => setOpen(false);

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-4 sticky top-0 z-50">
      
      <Link to="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-black text-white flex items-center justify-center rounded-[4px]">
          <Code2 className="w-3.5 h-3.5" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">Parallax</span>
      </Link>

      <div className="flex items-center gap-3">
        {account ? (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-emerald-500 border border-gray-200" />
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="text-xs font-semibold bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800 transition-colors"
          >
            Connect
          </button>
        )}

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="p-2 -mr-2 text-gray-600 hover:text-black hover:bg-gray-50 rounded-md transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-in fade-in" />
            <Dialog.Content className="fixed right-0 top-0 bottom-0 w-[280px] bg-white z-50 shadow-2xl animate-in slide-in-from-right-full duration-300 flex flex-col">
              
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                <span className="font-bold text-gray-900">Menu</span>
                <Dialog.Close asChild>
                  <button className="p-2 -mr-2 text-gray-400 hover:text-black rounded-md transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer</div>
                  <Link
                    to="/"
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm",
                      location.pathname === "/" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                </div>
                
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Worker</div>
                  <Link
                    to="/worker"
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm",
                      location.pathname === "/worker" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Briefcase className="w-4 h-4" />
                    Worker Hub
                  </Link>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-100 w-max mb-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Monad Testnet
                </div>
                {account && (
                  <div className="text-sm font-mono text-gray-500 truncate">
                    Wallet: {account}
                  </div>
                )}
              </div>

            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}

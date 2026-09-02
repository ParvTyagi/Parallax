import { Link, useLocation } from "react-router-dom";
import {
  PlusCircle,
  Compass,
  UserCircle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { ParallaxLogo } from "../ui/ParallaxLogo";
import { useWeb3 } from "../../contexts/Web3Context";

export default function Sidebar() {
  const location = useLocation();
  const { account } = useWeb3();
  const isAdmin = account?.toLowerCase() === "0xf302d2f179baf42d6f02e337b25cf882499b39e6";

  const isActive = (path: string) => {
    if (path === "/app") return location.pathname === "/app";
    if (path === "/worker") return location.pathname === "/worker";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 h-screen bg-base-100 border-r border-base-300 flex flex-col sticky top-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-base-300/80 shrink-0">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <ParallaxLogo />
        </Link>
      </div>

      {/* Nav List */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
        {/* Client Space */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-base-content/60 uppercase">
              Client
            </span>
          </div>
          <ul className="space-y-1">
            <li>
              <Link
                to="/app"
                aria-current={isActive("/app") ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive("/app")
                    ? "bg-neutral text-neutral-content font-semibold shadow-xs"
                    : "text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium"
                }`}
              >
                <PlusCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span>Post a Project</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Freelancer Space */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-base-content/60 uppercase">
              Freelancer
            </span>
          </div>
          <ul className="space-y-1">
            <li>
              <Link
                to="/worker"
                aria-current={
                  isActive("/worker") && !location.pathname.startsWith("/worker/0x") ? "page" : undefined
                }
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive("/worker") && !location.pathname.startsWith("/worker/0x")
                    ? "bg-neutral text-neutral-content font-semibold shadow-xs"
                    : "text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium"
                }`}
              >
                <Compass aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span>Marketplace</span>
              </Link>
            </li>
            {account && (
              <li>
                <Link
                  to={`/worker/${account}`}
                  aria-current={location.pathname === `/worker/${account}` ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    location.pathname === `/worker/${account}`
                      ? "bg-neutral text-neutral-content font-semibold shadow-xs"
                      : "text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium"
                  }`}
                >
                  <UserCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>My Profile & Stakes</span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* Admin Space (conditional) */}
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-wider text-warning uppercase">
                Admin Protocol
              </span>
            </div>
            <ul className="space-y-1">
              <li>
                <Link
                  to="/admin"
                  aria-current={isActive("/admin") ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive("/admin")
                      ? "bg-neutral text-neutral-content font-semibold shadow-xs"
                      : "text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium"
                  }`}
                >
                  <ShieldCheck aria-hidden="true" className="w-4 h-4 text-warning shrink-0" />
                  <span>Treasury & Fees</span>
                </Link>
              </li>
            </ul>
          </div>
        )}

        {/* Protocol Resources */}
        <div>
          <div className="px-3 mb-2">
            <span className="text-[11px] font-bold tracking-wider text-base-content/60 uppercase">
              Resources
            </span>
          </div>
          <ul className="space-y-1">
            <li>
              <Link
                to="/security"
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium transition-all"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-base-content/60" />
                  <span>Security & Trust</span>
                </div>
                <span className="badge badge-xs badge-outline text-[10px]">v1.0</span>
              </Link>
            </li>
            <li>
              <a
                href="https://testnet.monadexplorer.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium transition-all"
              >
                <div className="flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 shrink-0 text-base-content/60" />
                  <span>Monad Explorer</span>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Network Status Footer Card */}
      <div className="p-3 border-t border-base-300 bg-base-100 shrink-0">
        <div className="bg-base-200/80 border border-base-300/60 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  aria-hidden="true"
                  className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
                />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-xs font-semibold text-base-content">Monad Testnet</span>
            </div>
            <span className="badge badge-success badge-xs font-mono font-semibold">ONLINE</span>
          </div>
        </div>
      </div>
    </aside>
  );
}





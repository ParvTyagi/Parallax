import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Activity, Code2 } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Sidebar() {
  const location = useLocation();

  const customerLinks = [
    { name: "Dashboard", to: "/", icon: LayoutDashboard },
  ];

  const workerLinks = [
    { name: "Worker Hub", to: "/worker", icon: Briefcase },
  ];

  const NavItem = ({ name, to, icon: Icon }: any) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
          isActive
            ? "bg-black text-white shadow-sm"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600")} />
        {name}
      </Link>
    );
  };

  return (
    <div className="w-64 h-screen border-r border-gray-100 bg-gray-50/30 flex flex-col sticky top-0">
      
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 mb-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-[4px] shadow-sm group-hover:scale-105 transition-transform">
            <Code2 className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Parallax</span>
        </Link>
      </div>

      <div className="flex-1 px-4 overflow-y-auto space-y-8">
        
        {/* Customer Section */}
        <div>
          <div className="px-3 mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
            Customer
          </div>
          <div className="space-y-1">
            {customerLinks.map((link) => (
              <NavItem key={link.name} {...link} />
            ))}
          </div>
        </div>

        {/* Worker Section */}
        <div>
          <div className="px-3 mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
            Worker
          </div>
          <div className="space-y-1">
            {workerLinks.map((link) => (
              <NavItem key={link.name} {...link} />
            ))}
          </div>
        </div>

      </div>

      {/* Bottom status/branding */}
      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-100/50 rounded-lg p-3 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold text-gray-700">Network Status</span>
          </div>
          <span className="text-emerald-600">Operational</span>
        </div>
      </div>
    </div>
  );
}

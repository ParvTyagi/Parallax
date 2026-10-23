import { useEffect } from "react";
import { useLocation } from "react-router-dom";
const names: Record<string, string> = { "/": "Independent work. Shared progress.", "/security": "Trust & security", "/app": "Create a project", "/creator/new": "Create a project", "/creator/dashboard": "Project overview", "/worker": "Find work", "/worker/explore": "Find work", "/admin": "Protocol operations" };
export function RouteAnnouncer() {
  const { pathname, hash } = useLocation();
  const title = names[pathname] || (pathname.startsWith("/worker/") ? "Contributor profile" : pathname.startsWith("/task/") || pathname.startsWith("/workspace/") ? "Project details" : "Page not found");
  useEffect(() => {
    document.title = `${title} | Parallax`;
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash, title]);
  return <span role="status" aria-live="polite" className="sr-only">{title}</span>;
}

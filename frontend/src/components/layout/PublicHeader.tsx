import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ParallaxLogo } from "../ui/ParallaxLogo";

export function PublicHeader() {
  return <><a className="skip-link" href="#main-content">Skip to content</a><header className="brand-header">
    <Link to="/" aria-label="Parallax home"><ParallaxLogo /></Link>
    <nav aria-label="Public navigation"><Link to="/#process">How it works</Link><Link to="/worker">Find work</Link><Link to="/security">Trust & security</Link></nav>
    <Link to="/creator/dashboard" className="brand-header-cta">Open workspace <ArrowUpRight size={16} aria-hidden="true" /></Link>
  </header></>;
}

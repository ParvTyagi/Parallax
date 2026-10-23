export function ParallaxMark({ className = "w-8 h-8" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="48" height="48" rx="12" fill="#4F46E5" />
    <path d="M12 14h17l7 7H19l-7-7Z" fill="#D9F99D" />
    <path d="M12 23h17l7 7H19l-7-7Z" fill="white" />
    <path d="M12 32h9l7 7h-9l-7-7Z" fill="white" fillOpacity=".45" />
  </svg>;
}
export function ParallaxLogo({ className = "" }: { className?: string }) {
  return <span className={`parallax-wordmark ${className}`}><ParallaxMark /><span>parallax<span className="brand-period">.</span></span></span>;
}

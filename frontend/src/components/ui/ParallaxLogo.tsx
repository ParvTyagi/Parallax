export function ParallaxMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="plx-octo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#836EF9" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="currentColor" fillOpacity="0.08" />

      {/* Octopus Cyber-Head */}
      <path
        d="M32 10 L42 18 L42 28 L32 36 L22 28 L22 18 Z"
        stroke="url(#plx-octo-grad)"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
      />

      {/* Central Cybernetic Eye */}
      <circle cx="32" cy="23" r="3.5" fill="url(#plx-octo-grad)" />

      {/* Left Tentacles */}
      <path
        d="M22 20 Q14 16 8 22 Q5 26 7 32"
        stroke="url(#plx-octo-grad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 24 Q13 24 9 32 Q6 38 9 43"
        stroke="url(#plx-octo-grad)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M24 30 Q16 34 14 42 Q12 48 16 52"
        stroke="url(#plx-octo-grad)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />

      {/* Right Tentacles */}
      <path
        d="M42 20 Q50 16 56 22 Q59 26 57 32"
        stroke="url(#plx-octo-grad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M42 24 Q51 24 55 32 Q58 38 55 43"
        stroke="url(#plx-octo-grad)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M40 30 Q48 34 50 42 Q52 48 48 52"
        stroke="url(#plx-octo-grad)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ParallaxLogo({ className = "h-7" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <ParallaxMark className="w-7 h-7 shrink-0" />
      <div className="flex items-center gap-1.5 font-bold tracking-tight text-base">
        <span className="text-base-content font-extrabold tracking-tight">Parallax</span>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold bg-base-300/80 text-base-content/70">
          v1.0
        </span>
      </div>
    </div>
  );
}



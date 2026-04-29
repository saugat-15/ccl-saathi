import { cn } from "@/lib/utils";

type LogoMarkProps = { size?: number; className?: string };

/** The CCLSaathi icon mark — microphone with waveform bars, on a dark forest gradient. */
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a3d28" />
          <stop offset="100%" stopColor="#0d2418" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#logo-bg)" />
      <path
        d="M0,28 L3,25 L7,27 L10,22 L13,25 L16,19 L20,22.5 L23,18 L26,21 L29,19 L32,21 L32,32 L0,32Z"
        fill="#5e9c6d"
        opacity="0.2"
      />
      {/* Mic body */}
      <rect x="13" y="7" width="6" height="11" rx="3" stroke="white" strokeWidth="1.5" fill="none" />
      {/* Amber waveform bars */}
      <rect x="14"   y="13"   width="1.5" height="2.5" rx="0.5" fill="#e8a93a" />
      <rect x="15.5" y="10.5" width="1.5" height="5"   rx="0.5" fill="#e8a93a" />
      <rect x="17"   y="12"   width="1.5" height="3.5" rx="0.5" fill="#e8a93a" />
      {/* Boom arc */}
      <path d="M9 17.5 Q9 24.5 16 24.5 Q23 24.5 23 17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Stand + base */}
      <line x1="16" y1="24.5" x2="16" y2="27" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="27"   x2="20" y2="27" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Amber accent dot */}
      <circle cx="24.5" cy="6.5" r="2.5" fill="#e8a93a" />
      <circle cx="24.5" cy="6.5" r="1.2" fill="#1d4d30" />
    </svg>
  );
}

type LogoProps = {
  variant?: "full" | "icon" | "wordmark";
  iconSize?: number;
  className?: string;
};

export default function Logo({ variant = "full", iconSize = 28, className }: LogoProps) {
  if (variant === "icon") {
    return <LogoMark size={iconSize} className={className} />;
  }

  const wordmark = (
    <div>
      <div className="font-serif font-semibold text-[17px] leading-none tracking-tight text-foreground">
        CCLSaathi
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
        Nepali · CCL
      </div>
    </div>
  );

  if (variant === "wordmark") {
    return <div className={className}>{wordmark}</div>;
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={iconSize} />
      {wordmark}
    </div>
  );
}

import { useTheme } from '@/context/ThemeContext';

interface LogoProps {
  size?: number;
  className?: string;
}

export function TelemaxLogo({ size = 48, className = '' }: LogoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`logo-glow ${className}`}
    >
      <defs>
      <linearGradient id="glassBody" x1="30" y1="15" x2="90" y2="105" gradientUnits="userSpaceOnUse">
        <stop stopColor={isDark ? '#2cc4c0' : '#14a8a4'} />
        <stop offset="0.5" stopColor={isDark ? '#1d52f5' : '#3470ff'} />
        <stop offset="1" stopColor={isDark ? '#0a6e6c' : '#14a8a4'} />
      </linearGradient>
      <linearGradient id="glassShine" x1="35" y1="10" x2="65" y2="55" gradientUnits="userSpaceOnUse">
        <stop stopColor="rgba(255,255,255,0.85)" />
        <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
      </linearGradient>
      <linearGradient id="glassEdge" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="rgba(255,255,255,0.7)" />
        <stop offset="1" stopColor="rgba(255,255,255,0.15)" />
      </linearGradient>
      <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      </defs>

      {/* Outer glass disc */}
      <circle cx="60" cy="60" r="50" fill="url(#glassBody)" opacity="0.9" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="url(#glassEdge)" strokeWidth="2" />

      {/* Glass refraction highlight - top left */}
      <ellipse cx="45" cy="35" rx="28" ry="20" fill="url(#glassShine)" opacity="0.6" />

      {/* Inner glass circle */}
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      {/* Speech bubble shape carved in glass */}
      <path
        d="M38 48 Q38 42 44 42 L76 42 Q82 42 82 48 L82 64 Q82 70 76 70 L54 70 L46 78 L48 70 L44 70 Q38 70 38 64 Z"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Three dots inside speech bubble */}
      <circle cx="50" cy="56" r="3" fill="rgba(255,255,255,0.9)" />
      <circle cx="60" cy="56" r="3" fill="rgba(255,255,255,0.7)" />
      <circle cx="70" cy="56" r="3" fill="rgba(255,255,255,0.5)" />

      {/* Bottom glass refraction */}
      <ellipse cx="70" cy="85" rx="30" ry="12" fill="rgba(255,255,255,0.06)" filter="url(#softBlur)" />
    </svg>
  );
}

export function TelemaxLogoMark({ size = 48, className = '' }: LogoProps) {
  return (
    <div className={className}>
      <TelemaxLogo size={size} />
    </div>
  );
}

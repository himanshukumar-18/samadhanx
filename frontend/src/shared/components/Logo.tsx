import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-9 h-9 text-sm rounded-xl',
    lg: 'w-11 h-11 text-base rounded-2xl',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const svgSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 flex-shrink-0 group select-none ${className}`}>
      {/* Clean Geometric SamadhanX Mark */}
      <div
        className={`${iconSizes[size]} bg-primary text-primary-foreground flex items-center justify-center font-black shadow-md shadow-primary/20 group-hover:scale-105 transition-transform flex-shrink-0`}
      >
        <svg
          className={svgSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Modern Geometric Solution Flag Mark */}
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </div>

      {/* Modern Wordmark */}
      {showWordmark && (
        <span className={`font-black tracking-tight text-foreground ${textSizes[size]}`}>
          Samadhan<span className="text-primary">X</span>
        </span>
      )}
    </div>
  );
};

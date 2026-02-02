import React from 'react';

// Logo.tsx
interface LogoProps {
  className?: string;
  sector?: string;
  campus?: string;
  boldSubtext?: boolean;
  theme?: 'light' | 'dark';
}

export const IfrnLogo: React.FC<LogoProps> = ({ className = "", sector = "", campus = "", boldSubtext = false, theme = 'dark' }) => {
  const textColor = theme === 'light' ? 'text-white' : 'text-gray-800';
  const subtextColor = theme === 'light' ? 'text-white/80' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Logo */}
      <svg
        viewBox="0 0 110 150"
        className="w-10 h-10 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Red Circle (Top Left) */}
        <circle cx="16" cy="16" r="16" fill="#CB161D" />

        {/* Top Row Green Squares */}
        <rect x="38" y="0" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="76" y="0" width="32" height="32" rx="6" fill="#78BE20" />

        {/* segunda linha */}
        <rect x="0" y="38" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="38" width="32" height="32" rx="6" fill="#78BE20" />


        {/* terceira linha */}
        <rect x="0" y="76" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="76" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="76" y="76" width="32" height="32" rx="6" fill="#78BE20" />

        {/* quarta linha */}
        <rect x="0" y="114" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="114" width="32" height="32" rx="6" fill="#78BE20" />
      </svg>

      {/* Text */}
      <div className="flex flex-col leading-none items-start text-left">
        <span className={`font-bold text-xl tracking-tight whitespace-nowrap ${textColor}`}>IFRN</span>
        <span className={`text-[10px] sm:text-xs tracking-wider uppercase ${boldSubtext ? `font-black ${textColor}` : `font-semibold ${subtextColor}`}`}>
          {sector}{sector && campus && " - "}{campus}
        </span>
      </div>
    </div>
  );
};
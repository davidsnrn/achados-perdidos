import React from 'react';

interface LogoProps {
  className?: string;
  sector?: string;
  campus?: string;
}

export const IfrnLogo: React.FC<LogoProps> = ({ className = "", sector = "COADES", campus = "NOVA CRUZ" }) => {
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
      <div className="flex flex-col leading-none">
        <span className="font-bold text-xl tracking-tight text-gray-800">IFRN</span>
        <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
          {sector} - {campus}
        </span>
      </div>
    </div>
  );
};
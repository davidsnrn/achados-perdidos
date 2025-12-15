import React from 'react';

export const IfrnLogo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon Graphic */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <div className="absolute top-0 left-0 w-4 h-4 bg-ifrn-red rounded-full"></div>
        <div className="absolute top-0 right-0 w-4 h-4 bg-ifrn-green rounded-sm"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 bg-ifrn-green rounded-sm"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-ifrn-red rounded-full"></div>
      </div>
      {/* Text */}
      <div className="flex flex-col leading-none">
        <span className="font-bold text-xl tracking-tight text-gray-800">IFRN</span>
        <span className="text-xs font-semibold text-gray-500 tracking-wider">COADES - NATAL CENTRAL</span>
      </div>
    </div>
  );
};

import React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  isActive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, onClick, isActive }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-2xl shadow-sm border ${isActive ? 'ring-2 ring-slate-400 border-transparent shadow-md scale-[1.02]' : 'border-slate-100'} flex items-center gap-4 hover:shadow-md transition-all ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className={`p-4 rounded-xl ${color} text-white`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;

import React from 'react';
import type { SummaryCardProps } from './ForecastPanel.types';

export const SummaryCard = (props: SummaryCardProps & { t?: any }) => {
  const { icon: Icon, label, value, isDarkMode, color } = props;
  const colorMap: Record<string, string> = {
    gold: isDarkMode ? 'bg-gold/20 text-gold' : 'bg-gold/10 text-gold',
    emerald: isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
    blue: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
    violet: isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700',
  };
  return (
    <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-white border-slate-200'} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 h-full w-1/2 opacity-5">
        {Icon && <Icon className="absolute top-1/2 right-4 -translate-y-1/2 w-16 h-16" />}
      </div>
      <div className="relative z-10">
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className={`text-3xl font-bold mt-2 ${colorMap[color] || colorMap.gold}`}>
          {value}
        </p>
      </div>
    </div>
  );
};

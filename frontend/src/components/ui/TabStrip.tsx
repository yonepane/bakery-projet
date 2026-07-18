import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface TabStripProps {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  variant?: 'default' | 'panel';
}

export const TabStrip: React.FC<TabStripProps> = ({ tabs, active, onChange, isDarkMode, variant = 'default' }) => {
  if (variant === 'panel') {
    return (
      <div className={`flex gap-1 rounded-xl border p-1 ${isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
                active === tab.value
                  ? (isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-gold text-charcoal shadow-lg')
                  : (isDarkMode ? 'text-cream/60 hover:text-white' : 'text-slate-500 hover:text-slate-900')
              }`}
            >
              {Icon && <Icon size={14} />}
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            active === tab.value
              ? isDarkMode
                ? 'bg-gold text-charcoal'
                : 'bg-slate-900 text-white'
              : isDarkMode
                ? 'bg-white/5 text-cream/40 hover:bg-white/10'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};


import React from 'react';
import type { InsightCardProps } from './ForecastPanel.types';

export const InsightCard = (props: InsightCardProps) => {
  const { title, items, isDarkMode } = props;
  return (
    <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border-slate-50 border border-slate-200'}`}>
      <h4 className={`text-sm font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-cream/60' : 'text-slate-600'}`}>
              <span className="w-2 h-2 rounded-full bg-gold/50" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-sm ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>
          {'—'}
        </p>
      )}
    </div>
  );
};

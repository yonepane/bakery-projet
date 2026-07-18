import React from 'react';

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  isDarkMode: boolean;
  actions?: React.ReactNode;
  /** Override the heading size class. Defaults to 'text-4xl'. */
  titleSize?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  isDarkMode,
  actions,
  titleSize = 'text-4xl',
}) => (
  <div className="flex justify-between items-center">
    <div>
      <h3
        className={`${titleSize} font-bold luxury-font uppercase tracking-tighter ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h3>
      {subtitle && (
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

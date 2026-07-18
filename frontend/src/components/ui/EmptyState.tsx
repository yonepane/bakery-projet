import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Td, TableRow } from './Table';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  isDarkMode: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, isDarkMode }) => (
  <div className="p-12 text-center">
    <Icon className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/10' : 'text-slate-200'}`} />
    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
    {subtitle && (
      <p className={`mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{subtitle}</p>
    )}
  </div>
);

interface EmptyRowProps {
  colSpan: number;
  message: string;
  isDarkMode: boolean;
  icon?: React.ReactNode;
}

export const EmptyRow: React.FC<EmptyRowProps> = ({ colSpan, message, isDarkMode, icon }) => (
  <TableRow isDarkMode={isDarkMode}>
    <Td colSpan={colSpan} className="py-20 text-center opacity-20 font-black uppercase tracking-widest text-[10px]">
      {icon && <div className="flex justify-center mb-4">{icon}</div>}
      {message}
    </Td>
  </TableRow>
);

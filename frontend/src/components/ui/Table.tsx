import React, { ReactNode } from 'react';

export const Table = ({ children, className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={`w-full text-left ${className}`} {...props}>
    {children}
  </table>
);

interface SharedProps {
  children?: ReactNode;
  className?: string;
  isDarkMode?: boolean;
}

export const TableHeader = ({ isDarkMode = false, children, className = '', ...props }: SharedProps & React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...props}>
    <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'} ${className}`}>
      {children}
    </tr>
  </thead>
);

export const TableBody = ({ isDarkMode = false, children, className = '', ...props }: SharedProps & React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'} ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ isDarkMode = false, children, className = '', ...props }: SharedProps & React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={`group transition-colors ${isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} ${className}`} {...props}>
    {children}
  </tr>
);

export const Th = ({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => {
  const baseClass = className.includes('p-') || className.includes('px-') || className.includes('py-') ? className : `px-8 py-5 ${className}`;
  return <th className={baseClass} {...props}>{children}</th>;
};

export const Td = ({ children, className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
  const baseClass = className.includes('p-') || className.includes('px-') || className.includes('py-') ? className : `px-8 py-5 ${className}`;
  return <td className={baseClass} {...props}>{children}</td>;
};

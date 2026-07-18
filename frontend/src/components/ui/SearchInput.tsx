import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode: boolean;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  isDarkMode,
  className = '',
}) => (
  <div
    className={`flex-1 flex items-center gap-3 border-b min-w-[180px] ${
      isDarkMode ? 'border-white/10' : 'border-slate-200'
    } ${className}`}
  >
    <Search size={14} className="opacity-40 shrink-0" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent py-2 outline-none text-sm font-bold ${
        isDarkMode
          ? 'text-cream placeholder:text-cream/20'
          : 'text-slate-900 placeholder:text-slate-300'
      }`}
    />
  </div>
);

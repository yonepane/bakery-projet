import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Action {
  name: string;
  category: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: (close: boolean) => void;
  isDarkMode: boolean;
  actions: Action[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, isDarkMode, actions }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredActions = actions.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/50 backdrop-blur-sm" 
        onClick={() => onClose(true)}
      >
        <motion.div 
          initial={{ scale: 0.95 }} 
          animate={{ scale: 1 }} 
          exit={{ scale: 0.95 }} 
          onClick={e => e.stopPropagation()} 
          className={`w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center px-6 py-4 border-b border-white/10">
            <Search className="text-slate-400 mr-4" size={24} />
            <input 
              autoFocus 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              placeholder="Type a command or search..." 
              className={`flex-1 bg-transparent border-none outline-none text-xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`} 
            />
            <button onClick={() => onClose(true)}><X size={24} className="text-slate-400" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {filteredActions.map((action, i) => (
              <button 
                key={i} 
                onClick={() => { action.onSelect(); onClose(true); setQuery(''); }} 
                className={`w-full text-left px-6 py-4 rounded-2xl flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gold/10 hover:text-gold text-white' : 'hover:bg-slate-100 text-slate-900'}`}
              >
                <span className="font-bold">{action.name}</span>
                <span className="text-xs uppercase tracking-widest opacity-40">{action.category}</span>
              </button>
            ))}
            {filteredActions.length === 0 && <div className="p-8 text-center opacity-40">No commands found.</div>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

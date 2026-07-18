import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  isDarkMode: boolean;
  maxWidth?: string;
  className?: string;
  overlayClassName?: string;
  onClose?: () => void;
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  isDarkMode, 
  maxWidth = 'max-w-md', 
  className = '',
  overlayClassName = 'p-4 bg-black/50 backdrop-blur-sm',
  onClose,
  children 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center ${overlayClassName}`} onClick={onClose}>
      <div className={`w-full ${maxWidth} rounded-2xl ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'} ${className}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

interface ModalHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  isDarkMode?: boolean;
  withBorder?: boolean;
  icon?: any;
  iconColor?: string;
  iconBg?: string;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ 
  title, 
  subtitle, 
  onClose, 
  isDarkMode = false, 
  withBorder = false,
  icon: Icon,
  iconColor = 'text-slate-500',
  iconBg = 'bg-slate-100',
  className
}) => (
  <div className={className ?? `flex justify-between items-start shrink-0 ${withBorder ? 'p-6 border-b' : 'mb-6'} ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{subtitle}</p>}
      </div>
    </div>
    {onClose && (
      <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}>
        <X size={18} />
      </button>
    )}
  </div>
);

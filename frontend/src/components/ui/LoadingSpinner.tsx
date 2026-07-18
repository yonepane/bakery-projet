import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Height of the container. Defaults to 400px. */
  height?: number;
  /** Optional message to display below the spinner. */
  message?: string;
  isDarkMode?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  height = 400,
  message,
  isDarkMode,
}) => (
  <div
    className="flex flex-col items-center justify-center gap-4"
    style={{ height: `${height}px` }}
  >
    <Loader2 className="w-10 h-10 animate-spin text-gold" />
    {message && (
      <p className={`text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
        {message}
      </p>
    )}
  </div>
);

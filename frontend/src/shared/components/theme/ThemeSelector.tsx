import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../../hooks/useTheme';
import { Sun, Moon, Laptop, ChevronDown } from 'lucide-react';

export const ThemeSelector: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors justify-center focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="Select color theme"
      >
        {resolvedTheme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 sm:w-36 py-1.5 bg-card rounded-xl shadow-2xl border border-border z-50 animate-fade-in text-xs font-medium">
          <button
            onClick={() => { setTheme('light'); setIsOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/70 transition-colors ${theme === 'light' ? 'text-primary font-bold' : 'text-foreground'}`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
          </button>
          <button
            onClick={() => { setTheme('dark'); setIsOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/70 transition-colors ${theme === 'dark' ? 'text-indigo-400 font-bold' : 'text-foreground'}`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" /> Dark
          </button>
          <button
            onClick={() => { setTheme('system'); setIsOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/70 transition-colors ${theme === 'system' ? 'text-primary font-bold' : 'text-foreground'}`}
          >
            <Laptop className="w-3.5 h-3.5 text-muted-foreground" /> System
          </button>
        </div>
      )}
    </div>
  );
};

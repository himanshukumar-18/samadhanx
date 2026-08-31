import { useContext } from 'react';
import { ThemeContext, type Theme } from '@/context/theme-context';

export { type Theme };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { AppRoutes } from './routes/AppRoutes';
import { ThemeProvider } from './context/ThemeContext';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'bg-card text-foreground border border-border shadow-lg rounded-xl text-sm font-medium',
            duration: 3500,
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

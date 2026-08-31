import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
      outline: 'border border-slate-700 hover:bg-slate-800 text-slate-200',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
      ghost: 'hover:bg-slate-800 text-slate-300',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs font-medium rounded-md',
      md: 'px-4 py-2 text-sm font-medium rounded-lg',
      lg: 'px-5 py-2.5 text-base font-semibold rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

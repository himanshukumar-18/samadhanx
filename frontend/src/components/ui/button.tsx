import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary:
        'bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-sm transition-all active:scale-[0.98]',
      secondary:
        'bg-secondary hover:opacity-90 text-secondary-foreground font-medium transition-all active:scale-[0.98]',
      outline:
        'border border-border bg-card hover:bg-muted text-foreground font-medium transition-colors',
      accent:
        'bg-accent hover:bg-accent-hover text-accent-foreground font-semibold shadow-sm transition-all active:scale-[0.98]',
      ghost:
        'hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors',
      danger:
        'bg-destructive hover:opacity-90 text-destructive-foreground font-semibold shadow-sm transition-all',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
      md: 'px-4 py-2 text-sm rounded-lg gap-2',
      lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-lg justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-sans select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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

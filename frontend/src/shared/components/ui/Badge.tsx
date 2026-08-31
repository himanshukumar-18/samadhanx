import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'citizen' | 'student' | 'faculty' | 'industry' | 'university' | 'admin' | 'pending' | 'approved' | 'rejected' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  const styles = {
    citizen: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    student: 'bg-primary/10 text-primary border-primary/20',
    faculty: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    industry: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    university: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    admin: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    default: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase',
          styles[variant],
          className
        )
      )}
    >
      {children}
    </span>
  );
};

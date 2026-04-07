import React from 'react';
import { cn } from '../../lib/utils';

export const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
    outline: 'border border-border text-stone-700 hover:bg-stone-50 hover:text-stone-900',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none', 
        variants[variant], 
        className
      )} 
      {...props} 
    />
  );
};

import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    // Variant styles using Tailwind classes
    const variantStyles = {
      primary: 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500',
      secondary: 'bg-sand-300 text-gray-900 hover:bg-sand-400 focus:ring-sand-300',
      outline: 'border border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500',
      ghost: 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500',
      destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    };
    
    // Size styles using Tailwind classes
    const sizeStyles = {
      sm: 'h-9 px-3 py-1.5 text-sm rounded',
      md: 'h-10 px-4 py-2 rounded-md',
      lg: 'h-11 px-6 py-3 text-lg rounded-md',
      icon: 'h-10 w-10 rounded-full p-0',
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
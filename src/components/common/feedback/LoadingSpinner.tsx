import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'light' | 'primary';
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = 'default',
  className,
  label,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  const colorClasses = {
    default: 'border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-300',
    light: 'border-gray-200 border-t-white',
    primary: 'border-green-200 border-t-green-500',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full',
          sizeClasses[size],
          colorClasses[color]
        )}
      />
      {label && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{label}</div>
      )}
    </div>
  );
}
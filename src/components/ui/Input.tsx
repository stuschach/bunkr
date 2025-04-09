import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            className={cn(
              "flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
              "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-gray-700 dark:text-gray-100",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-red-500 focus:ring-red-500",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : helper ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helper}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
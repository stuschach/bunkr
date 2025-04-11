// src/components/ui/Input.tsx
import React, { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, leftIcon, rightIcon, multiline, rows = 3, ...props }, ref) => {
    // Create common styles for both input and textarea
    const inputStyles = cn(
      "flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "dark:border-gray-700 dark:text-gray-100",
      leftIcon && "pl-10",
      rightIcon && "pr-10",
      error && "border-red-500 focus:ring-red-500",
      className
    );

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
          
          {multiline ? (
            // Render textarea when multiline is true
            <textarea
              className={inputStyles}
              rows={rows}
              id={props.id}
              name={props.name}
              placeholder={props.placeholder}
              disabled={props.disabled}
              required={props.required}
              aria-describedby={props.id ? `${props.id}-description` : undefined}
              onChange={props.onChange as any}
              value={props.value}
              // Only forward valid textarea props
              {...(props as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            // Render input when multiline is false or undefined
            <input
              className={cn(inputStyles, "h-10")}
              ref={ref as any}
              // Omit the multiline and rows props from being passed to the input element
              {...((() => {
                const { multiline, rows, ...rest } = props;
                return rest;
              })())}
            />
          )}
          
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
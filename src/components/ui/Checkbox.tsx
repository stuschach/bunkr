// src/components/ui/Checkbox.tsx
import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helper?: string;
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, helper, indeterminate, ...props }, ref) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    const mergedRef = (node: HTMLInputElement) => {
      // Set both refs
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      checkboxRef.current = node;
    };

    return (
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            ref={mergedRef}
            type="checkbox"
            className={cn(
              "h-4 w-4 rounded border-gray-300 text-green-fairway",
              "focus:ring-2 focus:ring-green-fairway focus:ring-offset-2",
              "dark:border-gray-600 dark:bg-gray-800 dark:ring-offset-gray-950",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus:ring-red-500",
              className
            )}
            {...props}
          />
        </div>
        {(label || helper || error) && (
          <div className="ml-3 text-sm">
            {label && (
              <label 
                htmlFor={props.id} 
                className={cn(
                  "font-medium text-gray-700 dark:text-gray-300",
                  props.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {helper && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helper}</p>
            )}
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
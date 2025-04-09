import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  label?: string;
  error?: string;
  helper?: string;
  onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, label, error, helper, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(event.target.value);
      }
    };

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
          <select
            className={cn(
              "block w-full rounded-md border border-gray-300 bg-white text-gray-900",
              "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
              "py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus:ring-red-500",
              className
            )}
            onChange={handleChange}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
            <svg
              className="h-4 w-4 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        {error ? (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
        ) : helper ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helper}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
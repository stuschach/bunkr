import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  options: RadioOption[];
  name: string;
  label?: string;
  error?: string;
  helper?: string;
  onChange?: (value: string) => void;
  layout?: 'vertical' | 'horizontal';
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, options, name, label, error, helper, onChange, layout = 'vertical', ...props }, ref) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <div className={cn("space-y-2", className)} ref={ref}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        
        <div 
          className={cn(
            layout === 'vertical' ? "space-y-2" : "flex flex-wrap space-x-4"
          )}
        >
          {options.map((option) => (
            <div key={option.value} className="flex items-center">
              <input
                id={`${name}-${option.value}`}
                name={name}
                type="radio"
                value={option.value}
                disabled={option.disabled || props.disabled}
                onChange={handleChange}
                checked={props.value === option.value}
                className={cn(
                  "h-4 w-4 border-gray-300 text-green-500",
                  "focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                  "dark:border-gray-600 dark:bg-gray-800 dark:ring-offset-gray-950",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  error && "border-red-500 focus:ring-red-500"
                )}
                {...props}
              />
              <label
                htmlFor={`${name}-${option.value}`}
                className={cn(
                  "ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300",
                  (option.disabled || props.disabled) && "opacity-50 cursor-not-allowed"
                )}
              >
                {option.label}
              </label>
            </div>
          ))}
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

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
// src/components/ui/Slider.tsx
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

// Define a separate interface for the slider-specific props
interface SliderBaseProps {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  showValue?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

// Extend HTMLAttributes<HTMLDivElement> separately and merge with our base props
export type SliderProps = SliderBaseProps & Omit<React.HTMLAttributes<HTMLDivElement>, keyof SliderBaseProps>;

const Slider = forwardRef<HTMLDivElement, SliderProps>(
  ({ 
    className, 
    value, 
    onChange, 
    onChangeEnd, 
    min = 0, 
    max = 100, 
    step = 1, 
    label, 
    helper,
    error,
    disabled = false,
    showValue = false,
    valuePrefix = '',
    valueSuffix = '',
    ...props 
  }, ref) => {
    const percentage = ((value - min) / (max - min)) * 100;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    };
    
    const handleChangeEnd = () => {
      if (onChangeEnd) {
        onChangeEnd(value);
      }
    };

    return (
      <div className={cn("space-y-2", className)} ref={ref} {...props}>
        <div className="flex justify-between items-center">
          {label && (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {valuePrefix}{value}{valueSuffix}
            </span>
          )}
        </div>
        
        <div className="relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            onMouseUp={handleChangeEnd}
            onTouchEnd={handleChangeEnd}
            disabled={disabled}
            className={cn(
              "w-full h-2 appearance-none rounded-md bg-gray-200 dark:bg-gray-700 cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-green-fairway focus:ring-offset-2 dark:focus:ring-offset-gray-950",
              disabled && "opacity-50 cursor-not-allowed",
              "range-input" // Custom class for styling input range
            )}
          />
          <div 
            className="absolute pointer-events-none left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-md bg-green-fairway" 
            style={{ width: `${percentage}%` }}
          />
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

Slider.displayName = 'Slider';

export { Slider };
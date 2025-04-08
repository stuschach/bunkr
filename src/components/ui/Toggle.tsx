import React from 'react';
import { cn } from '@/lib/utils/cn';

interface ToggleProps extends React.HTMLAttributes<HTMLButtonElement> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed, onPressedChange, disabled = false, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-8 after:h-3 after:w-3",
      md: "h-6 w-11 after:h-5 after:w-5",
      lg: "h-7 w-14 after:h-6 after:w-6",
    };
    
    return (
      <button
        type="button"
        aria-pressed={pressed}
        data-state={pressed ? "on" : "off"}
        disabled={disabled}
        ref={ref}
        onClick={() => onPressedChange(!pressed)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          "after:absolute after:top-[1px] after:left-[1px] after:translate-x-0",
          "after:rounded-full after:bg-white after:shadow-lg after:transition-transform",
          pressed ? "bg-green-fairway after:translate-x-full" : "bg-gray-300",
          disabled && "opacity-50 cursor-not-allowed",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Toggle.displayName = "Toggle";

export { Toggle };
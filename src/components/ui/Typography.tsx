import React from 'react';
import { cn } from '@/lib/utils/cn';

// Heading components
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level = 1, ...props }, ref) => {
    const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    
    const styles = {
      h1: "text-4xl font-bold tracking-tight",
      h2: "text-3xl font-semibold tracking-tight",
      h3: "text-2xl font-semibold",
      h4: "text-xl font-semibold",
      h5: "text-lg font-medium",
      h6: "text-base font-medium",
    };
    
    return (
      <Component
        ref={ref}
        className={cn(styles[Component], "font-heading", className)}
        {...props}
      />
    );
  }
);
Heading.displayName = "Heading";

// Text component for paragraphs
interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  variant?: 'default' | 'muted' | 'accent';
}

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, size = 'base', variant = 'default', ...props }, ref) => {
    
    const sizeStyles = {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    };
    
    const variantStyles = {
      default: "text-gray-900 dark:text-gray-50",
      muted: "text-gray-500 dark:text-gray-400",
      accent: "text-green-500 dark:text-green-300",
    };
    
    return (
      <p
        ref={ref}
        className={cn(
          "font-body",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Heading, Text };
import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

// Card container
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  gradient?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, gradient = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 shadow-sm overflow-hidden",
        gradient && "bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

// Card header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-4 border-b border-gray-200 dark:border-gray-800", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

// Card title
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

// Card description
interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

// Card content
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

// Card footer
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-4 border-t border-gray-200 dark:border-gray-800", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
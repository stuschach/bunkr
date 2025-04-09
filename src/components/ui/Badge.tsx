import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-green-500 text-white", // Was "bg-green-fairway"
        secondary: "bg-sand-300 text-gray-900", // Was "bg-sand-bunker"
        outline: "border border-green-500 text-green-500", // Was "border-green-fairway text-green-fairway"
        success: "bg-green-500 text-white",
        warning: "bg-amber-500 text-white",
        error: "bg-red-500 text-white",
        info: "bg-sky-300 text-gray-900", // Was "bg-sky-light"
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
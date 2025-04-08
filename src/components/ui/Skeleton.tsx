// src/components/ui/Skeleton.tsx
import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  animation = 'pulse',
  width,
  height,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-gray-200 dark:bg-gray-700",
        {
          'rounded-full': variant === 'circular',
          'rounded-md': variant === 'rectangular',
          'h-4': variant === 'text' && !height,
          'animate-pulse': animation === 'pulse',
          'skeleton-wave': animation === 'wave',
        },
        className
      )}
      style={{
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
      {...props}
    />
  );
}

// Create some common skeleton components for convenience
export function SkeletonText({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      variant="text"
      className={cn("w-full", className)}
      {...props}
    />
  );
}

export function SkeletonAvatar({ size = 40, className, ...props }: Omit<SkeletonProps, 'width' | 'height'> & { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
      {...props}
    />
  );
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      <Skeleton className="h-40 w-full rounded-t-md" />
      <SkeletonText className="h-4 w-3/4" />
      <SkeletonText className="h-3 w-1/2" />
    </div>
  );
}
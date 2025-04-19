'use client';

import * as React from 'react';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

export function Separator({
  className = '',
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorProps) {
  // Combine classNames 
  const combinedClassName = [
    'shrink-0 bg-gray-200 dark:bg-gray-700',
    orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    className
  ].join(' ');

  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={combinedClassName}
      {...props}
    />
  );
}
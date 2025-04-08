import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 0,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timer.current) clearTimeout(timer.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const positions = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 mb-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 translate-x-2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 translate-y-2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 -translate-x-2 mr-2',
  };

  const arrows = {
    top: 'bottom-[-5px] left-1/2 transform -translate-x-1/2 border-t-gray-800 dark:border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent',
    right: 'left-[-5px] top-1/2 transform -translate-y-1/2 border-r-gray-800 dark:border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent',
    bottom: 'top-[-5px] left-1/2 transform -translate-x-1/2 border-b-gray-800 dark:border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-5px] top-1/2 transform -translate-y-1/2 border-l-gray-800 dark:border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent',
  };

  return (
    <div className="relative inline-block" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-900 rounded shadow-md',
            positions[position],
            className
          )}
        >
          {content}
          <div className={cn('absolute border-4', arrows[position])} />
        </div>
      )}
    </div>
  );
};
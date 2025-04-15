// src/components/common/feedback/PullToRefreshIndicator.tsx
import React from 'react';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  pullProgress: number;
  isRefreshing: boolean;
}

export function PullToRefreshIndicator({ 
  isPulling, 
  pullProgress,
  isRefreshing 
}: PullToRefreshIndicatorProps) {
  if (!isPulling && !isRefreshing) return null;
  
  // Calculate rotation based on pull progress
  const rotation = Math.min(pullProgress * 1.8, 180);
  
  return (
    <div 
      className="absolute top-0 left-0 right-0 flex justify-center items-center transition-all" 
      style={{ 
        height: isPulling ? `${Math.min(pullProgress * 0.8, 60)}px` : isRefreshing ? '60px' : '0px',
      }}
    >
      {isRefreshing ? (
        <LoadingSpinner size="sm" color="primary" />
      ) : (
        <div className="text-gray-500 dark:text-gray-400 transition-transform"
             style={{ transform: `rotate(${rotation}deg)` }}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
        </div>
      )}
      <div className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
        {isRefreshing 
          ? 'Refreshing...' 
          : pullProgress >= 100 
            ? 'Release to refresh' 
            : 'Pull to refresh'}
      </div>
    </div>
  );
}
// src/components/feed/FeedFilters.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';

interface FeedFiltersProps {
  activeFilter: 'all' | 'following';
  onFilterChange: (filter: 'all' | 'following') => void;
}

export function FeedFilters({ activeFilter, onFilterChange }: FeedFiltersProps) {
  return (
    <div className="flex border-b-2 border-gray-200 dark:border-gray-800 mb-6 sticky top-0 bg-white dark:bg-gray-900 z-10 py-1">
      <Button
        variant="ghost"
        className={`px-4 py-2 -mb-px font-medium transition-colors duration-200 ${
          activeFilter === 'all'
            ? 'text-green-600 border-b-2 border-green-500'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
        onClick={() => onFilterChange('all')}
      >
        For You
      </Button>
      <Button
        variant="ghost"
        className={`px-4 py-2 -mb-px font-medium transition-colors duration-200 ${
          activeFilter === 'following'
            ? 'text-green-600 border-b-2 border-green-500'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
        onClick={() => onFilterChange('following')}
      >
        Following
      </Button>
    </div>
  );
}
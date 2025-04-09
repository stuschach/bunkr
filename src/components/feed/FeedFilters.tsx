// src/components/feed/FeedFilters.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';

interface FeedFiltersProps {
  activeFilter: 'all' | 'following';
  onFilterChange: (filter: 'all' | 'following') => void;
}

export function FeedFilters({ activeFilter, onFilterChange }: FeedFiltersProps) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
      <Button
        variant="ghost"
        className={`px-4 py-2 -mb-px ${
          activeFilter === 'all'
            ? 'text-green-500 border-b-2 border-green-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
        }`}
        onClick={() => onFilterChange('all')}
      >
        For You
      </Button>
      <Button
        variant="ghost"
        className={`px-4 py-2 -mb-px ${
          activeFilter === 'following'
            ? 'text-green-500 border-b-2 border-green-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
        }`}
        onClick={() => onFilterChange('following')}
      >
        Following
      </Button>
    </div>
  );
}
// src/components/feed/SkeletonPostCard.tsx
// Skeleton loading component for posts

import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';

export const SkeletonPostCard: React.FC = () => {
  return (
    <Card className="my-3 animate-pulse">
      <CardContent className="pt-6">
        {/* Author header skeleton */}
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 mr-3"></div>
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded mt-2"></div>
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
        </div>
        
        {/* Image placeholder */}
        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-md mb-4"></div>
      </CardContent>
      
      <CardFooter className="border-t border-gray-100 dark:border-gray-800 pt-3 pb-3">
        <div className="flex justify-between w-full">
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </CardFooter>
    </Card>
  );
};
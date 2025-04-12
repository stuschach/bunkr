// src/app/(app)/feed/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FeedLayout } from '@/components/feed/FeedLayout';
import { PostComposer } from '@/components/feed/PostComposer';
import { FeedFilters } from '@/components/feed/FeedFilters';
import { OptimizedPostList } from '@/components/feed/OptimizedPostList';
import { SuggestedUsers } from '@/components/feed/SuggestedUsers';
import { TrendingCourses } from '@/components/feed/TrendingCourses';
import { UpcomingEvents } from '@/components/feed/UpcomingEvents';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';

export default function FeedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'posts' | 'rounds' | 'tee-times'>('all');
  // State to store the refresh function once OptimizedPostList is ready
  const [refreshFeed, setRefreshFeed] = useState<(() => void) | null>(null);

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?returnUrl=/feed');
    }
  }, [user, loading, router]);

  // Handler to receive the refresh function from OptimizedPostList
  const handleRefreshReady = useCallback((refreshFn: () => void) => {
    setRefreshFeed(() => refreshFn);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading feed..." />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <FeedLayout
      main={
        <>
          <PostComposer 
            user={user} 
            onPostCreated={refreshFeed ? refreshFeed : undefined}
          />
          
          <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-0 mb-0">
            <FeedFilters activeFilter={feedFilter} onFilterChange={setFeedFilter} />
            {/* Content type filters */}
            <div className="flex space-x-2 mb-4 -mt-2">
              <Badge 
                variant={contentTypeFilter === 'all' ? 'default' : 'outline'} 
                className={`cursor-pointer px-3 py-1 ${contentTypeFilter === 'all' ? 'bg-green-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => setContentTypeFilter('all')}
              >
                All Content
              </Badge>
              <Badge 
                variant={contentTypeFilter === 'posts' ? 'default' : 'outline'} 
                className={`cursor-pointer px-3 py-1 ${contentTypeFilter === 'posts' ? 'bg-green-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => setContentTypeFilter('posts')}
              >
                Posts
              </Badge>
              <Badge 
                variant={contentTypeFilter === 'rounds' ? 'default' : 'outline'} 
                className={`cursor-pointer px-3 py-1 ${contentTypeFilter === 'rounds' ? 'bg-green-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => setContentTypeFilter('rounds')}
              >
                Rounds
              </Badge>
              <Badge 
                variant={contentTypeFilter === 'tee-times' ? 'default' : 'outline'} 
                className={`cursor-pointer px-3 py-1 ${contentTypeFilter === 'tee-times' ? 'bg-green-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => setContentTypeFilter('tee-times')}
              >
                Tee Times
              </Badge>
            </div>
          </div>
          
          <OptimizedPostList 
            filter={feedFilter} 
            contentTypeFilter={contentTypeFilter}
            onRefreshReady={handleRefreshReady}
          />
        </>
      }
      sidebar={
        <>
          <SuggestedUsers />
          <TrendingCourses />
          <UpcomingEvents />
        </>
      }
    />
  );
}
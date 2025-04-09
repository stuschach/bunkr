// src/app/(app)/feed/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FeedLayout } from '@/components/feed/FeedLayout';
import { PostComposer } from '@/components/feed/PostComposer';
import { FeedFilters } from '@/components/feed/FeedFilters';
import { PostList } from '@/components/feed/PostList';
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

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?returnUrl=/feed');
    }
  }, [user, loading, router]);

  // Effect to clear console when filter changes (debugging aid)
  useEffect(() => {
    console.log(`Filter changed to: ${feedFilter}, content type: ${contentTypeFilter}`);
  }, [feedFilter, contentTypeFilter]);

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
          <PostComposer user={user} />
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
          {/* Force complete remount of PostList when filter changes */}
          <PostList 
            key={`feed-${feedFilter}-${contentTypeFilter}`} 
            filter={feedFilter} 
            contentTypeFilter={contentTypeFilter} 
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
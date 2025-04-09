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

export default function FeedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?returnUrl=/feed');
    }
  }, [user, loading, router]);

  // Effect to clear console when filter changes (debugging aid)
  useEffect(() => {
    console.log(`Filter changed to: ${feedFilter}`);
  }, [feedFilter]);

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
          <FeedFilters activeFilter={feedFilter} onFilterChange={setFeedFilter} />
          {/* Force complete remount of PostList when filter changes */}
          <PostList key={`feed-${feedFilter}`} filter={feedFilter} />
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
// src/components/feed/OptimizedPostList.tsx
// Optimized PostList component with refresh functionality exposed

import React, { useCallback, useEffect, useState } from 'react';
import { useFeed } from '@/lib/hooks/useFeed';
import { VirtualizedPostList } from '@/components/feed/PostList';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface OptimizedPostListProps {
  filter: 'all' | 'following';
  contentTypeFilter?: 'all' | 'posts' | 'rounds' | 'tee-times';
  onRefreshReady?: (refreshFn: () => void) => void; // Add callback to expose refresh function
}

export function OptimizedPostList({ 
  filter, 
  contentTypeFilter = 'all',
  onRefreshReady 
}: OptimizedPostListProps) {
  // We need to apply the filter from props to our feed hook
  const [feedType, setFeedType] = useState<'all' | 'following'>(filter);
  const [contentType, setContentType] = useState<'all' | 'posts' | 'rounds' | 'tee-times'>(
    contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times'
  );
  
  // Update state when props change
  useEffect(() => {
    setFeedType(filter);
  }, [filter]);
  
  useEffect(() => {
    setContentType(contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times');
  }, [contentTypeFilter]);
  
  // Use our custom hook for feed data
  const { 
    posts, 
    hasMore, 
    isLoadingInitial, 
    isLoadingMore = false, // Add default value to handle potentially undefined value
    error,
    loadMore,
    refresh, // This is the refresh function we need to expose
    toggleLike
  } = useFeed({
    contentTypeFilter: contentType,
    pageSize: 10,
  });
  
  // Expose the refresh function to parent components
  useEffect(() => {
    if (onRefreshReady && typeof refresh === 'function') {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);
  
  // Handle comment action
  const handleComment = useCallback((postId: string) => {
    console.log('Show comment form for post:', postId);
  }, []);

  // Handle share action
  const handleShare = useCallback((postId: string) => {
    console.log('Share post:', postId);
  }, []);
  
  // Show loading spinner for initial load
  if (isLoadingInitial) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner size="lg" color="primary" label="Loading posts..." />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Empty state */}
      {!isLoadingInitial && posts.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg text-center">
          <h3 className="text-lg font-medium mb-2">No posts found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {contentType === 'all' 
              ? 'Follow some golfers to see posts in your feed!'
              : `No ${contentType} found. Try a different filter or follow more golfers.`}
          </p>
        </div>
      )}
      
      {/* Virtualized post list */}
      <VirtualizedPostList
        posts={posts}
        hasMore={hasMore}
        isLoadingMore={Boolean(isLoadingMore)} // Ensure it's a boolean
        error={error}
        loadMore={loadMore}
        toggleLike={toggleLike}
        handleComment={handleComment}
        handleShare={handleShare}
      />
    </div>
  );
}
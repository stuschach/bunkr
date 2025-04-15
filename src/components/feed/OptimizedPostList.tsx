// src/components/feed/OptimizedPostList.tsx
// Enhanced with post deletion support
'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useFeed } from '@/lib/hooks/useFeed';
import { VirtualizedPostList } from '@/components/feed/PostList';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useVisibility } from '@/lib/contexts/VisibilityContext';
import { NewPostsNotification } from '@/components/feed/NewPostsNotification';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/common/feedback/PullToRefreshIndicator';
import { useToast } from '@/lib/hooks/useToast';
import { Post } from '@/types/post';

interface OptimizedPostListProps {
  filter: 'all' | 'following';
  contentTypeFilter?: 'all' | 'posts' | 'rounds' | 'tee-times';
  onRefreshReady?: (refreshFn: () => void) => void; // Callback to expose refresh function
}

// Utility to merge React refs safely
const mergeRefs = <T extends any>(
  refs: Array<React.MutableRefObject<T | null> | React.RefObject<T> | ((instance: T | null) => void) | null | undefined>
): React.RefCallback<T> => {
  return (value) => {
    refs.forEach(ref => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
};

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
  
  // Container ref for pull-to-refresh
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Access the visibility context
  const { registerPost } = useVisibility();

  // Local state to track deleted posts
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());
  
  // Toast notifications
  const { showToast } = useToast();
  
  // Update state when props change
  useEffect(() => {
    setFeedType(filter);
  }, [filter]);
  
  useEffect(() => {
    setContentType(contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times');
  }, [contentTypeFilter]);
  
  // Use our enhanced custom hook for feed data with reduced page size
  const { 
    posts, 
    hasMore, 
    isLoadingInitial, 
    isLoadingMore = false,
    error,
    loadMore,
    refresh,
    toggleLike,
    addComment,
    handlePostVisibility,
    newPostsCount,
    loadNewPosts
  } = useFeed({
    contentTypeFilter: contentType,
    pageSize: 5, // Reduced from 10 to 5 for better performance
    pollInterval: 30000, // Check for new posts every 30 seconds
  });
  
  // Setup pull-to-refresh
  const { 
    isPulling,
    pullProgress,
    isRefreshing,
    containerRef: pullToRefreshRef
  } = usePullToRefresh({
    onRefresh: async () => {
      await new Promise<void>((resolve) => {
        refresh();
        // Add slight delay to make the refresh feel more substantial
        setTimeout(resolve, 800);
      });
    },
    containerRef, // Pass the ref properly
    disabled: isLoadingInitial || isLoadingMore 
  });
  
  // Expose the refresh function to parent components
  useEffect(() => {
    if (onRefreshReady && typeof refresh === 'function') {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);
  
  // Handle like action with optimistic UI
  const handleLike = useCallback((postId: string, currentLikedStatus: boolean) => {
    return toggleLike(postId, currentLikedStatus);
  }, [toggleLike]);
  
  // Handle comment action
  const handleComment = useCallback((postId: string) => {
    console.log('Show comment form for post:', postId);
  }, []);

  // Handle share action
  const handleShare = useCallback((postId: string) => {
    console.log('Share post:', postId);
  }, []);
  
  // Handle post visibility changes for intersection observer
  const handlePostVisible = useCallback((postId: string, isVisible: boolean) => {
    // Update visibility in our feed hook
    handlePostVisibility(postId, isVisible);
  }, [handlePostVisibility]);

  // Handle post deletion - new handler
  const handlePostDeleted = useCallback((postId: string) => {
    console.log('Post deleted:', postId);
    
    // Add to local deleted posts set
    setDeletedPostIds(prev => {
      const newSet = new Set(prev);
      newSet.add(postId);
      return newSet;
    });
    
    // Show a subtle toast notification
    showToast({
      title: 'Post deleted',
      description: 'The post has been removed from your feed',
      variant: 'success',
      duration: 3000,
    });
    
  }, [showToast]);
  
  // Filter out deleted posts from the feed
  const filteredPosts = useMemo(() => {
    if (deletedPostIds.size === 0) return posts;
    
    return posts.filter(post => !deletedPostIds.has(post.id));
  }, [posts, deletedPostIds]);
  
  // Show loading spinner for initial load
  if (isLoadingInitial) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner size="lg" color="primary" label="Loading posts..." />
      </div>
    );
  }
  
  return (
    <div 
      // Use the utility to safely merge both refs
      ref={mergeRefs([containerRef, pullToRefreshRef])}
      className="relative overflow-hidden"
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator 
        isPulling={isPulling} 
        pullProgress={pullProgress} 
        isRefreshing={isRefreshing} 
      />
      
      {/* New posts notification */}
      <NewPostsNotification 
        count={newPostsCount} 
        onLoadNewPosts={loadNewPosts} 
      />
      
      <div className="space-y-4">
        {/* Empty state */}
        {!isLoadingInitial && filteredPosts.length === 0 && !isRefreshing && (
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg text-center">
            <h3 className="text-lg font-medium mb-2">No posts found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {contentType === 'all' 
                ? 'Follow some golfers to see posts in your feed!'
                : `No ${contentType} found. Try a different filter or follow more golfers.`}
            </p>
          </div>
        )}
        
        {/* Virtualized post list with visibility optimization */}
        <VirtualizedPostList
          posts={filteredPosts}
          hasMore={hasMore}
          isLoadingMore={Boolean(isLoadingMore)}
          error={error}
          loadMore={loadMore}
          toggleLike={handleLike}
          handleComment={handleComment}
          handleShare={handleShare}
          onPostVisible={handlePostVisible}
          onPostDeleted={handlePostDeleted} // Pass the new handler
        />
      </div>
    </div>
  );
}
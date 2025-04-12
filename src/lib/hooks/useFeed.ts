// src/lib/hooks/useFeed.ts
// Custom hook for feed management with SWR integration

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWRInfinite from 'swr/infinite';
import { getFeedForUser, togglePostLike } from '@/lib/firebase/feed-service';
import { Post, FeedQueryResult } from '@/types/post';
import { useAuth } from '@/lib/contexts/AuthContext';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface UseFeedOptions {
  contentTypeFilter?: 'all' | 'posts' | 'rounds' | 'tee-times';
  pageSize?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

// Define the proper key typing for SWR
type GetKeyType = (pageIndex: number, previousPageData: FeedQueryResult | null) => string | null;

// Define the fetcher function type
type FetcherType = (key: string) => Promise<FeedQueryResult>;

export function useFeed({
  contentTypeFilter = 'all',
  pageSize = 10,
  revalidateOnFocus = true,
  revalidateOnReconnect = true
}: UseFeedOptions = {}) {
  const { user } = useAuth();
  const [error, setError] = useState<Error | null>(null);
  
  // Store the lastVisible documents for each page
  const lastVisibleDocsRef = useRef<Map<number, QueryDocumentSnapshot<DocumentData>>>(new Map());
  
  // Fetch key generator for SWR infinite loading
  const getKey: GetKeyType = (pageIndex, previousPageData) => {
    // If no user or we've reached the end, return null
    if (!user || (previousPageData && !previousPageData.hasMore)) return null;
    
    // First page - no previousPageData
    if (pageIndex === 0) return `feed-${user.uid}-${contentTypeFilter}-0`;
    
    // Include the page index for pagination
    return `feed-${user.uid}-${contentTypeFilter}-${pageIndex}`;
  };
  
  // Custom fetcher that handles Firestore pagination
  const fetcher: FetcherType = async (key) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Parse the key to get pagination info
      const parts = key.split('-');
      const pageIndex = parseInt(parts[parts.length - 1] || '0');
      
      // Get the lastVisible document if needed
      let lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
      if (pageIndex > 0) {
        lastVisible = lastVisibleDocsRef.current.get(pageIndex - 1) || null;
      }
      
      const result = await getFeedForUser(
        user.uid,
        contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times',
        lastVisible,
        pageSize
      );
      
      // Store the lastVisible document for the next page
      if (result.lastVisible) {
        lastVisibleDocsRef.current.set(pageIndex, result.lastVisible);
      }
      
      return result;
    } catch (err) {
      console.error('Feed fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load feed'));
      throw err;
    }
  };
  
  // Use SWR Infinite for paginated data fetching
  const { 
    data: feedPages, 
    error: swrError, 
    size, 
    setSize, 
    isValidating,
    mutate 
  } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus,
    revalidateOnReconnect,
    persistSize: true,
    dedupingInterval: 5000, // 5 seconds
  });
  
  // Flatten all pages into a single posts array and remove duplicates
  const posts = feedPages ? 
    feedPages.flatMap(page => page.posts)
      .filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      ) : [];
      
  const hasMore = feedPages ? feedPages[feedPages.length - 1]?.hasMore : true;
  const isLoadingInitial = !feedPages && !swrError;
  const isLoadingMore = isValidating || (size > 0 && feedPages && typeof feedPages[size - 1] === 'undefined');
  
  // Set the error from SWR if there is one
  useEffect(() => {
    if (swrError) {
      setError(swrError instanceof Error ? swrError : new Error(String(swrError)));
    }
  }, [swrError]);
  
  // Clear lastVisibleDocs when contentTypeFilter changes
  useEffect(() => {
    lastVisibleDocsRef.current.clear();
  }, [contentTypeFilter]);
  
  // Function to load more posts
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setSize(size + 1);
    }
  }, [size, setSize, isLoadingMore, hasMore]);
  
  // Function to refresh the feed
  const refresh = useCallback(() => {
    // Clear the lastVisibleDocs when refreshing
    lastVisibleDocsRef.current.clear();
    mutate();
  }, [mutate]);
  
  // Toggle like for a post with optimistic UI
  const toggleLike = useCallback(async (postId: string, currentLikedStatus: boolean) => {
    if (!user) return;
    
    try {
      // Optimistically update the UI
      const optimisticData = feedPages?.map(page => ({
        ...page,
        posts: page.posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes: post.likes + (currentLikedStatus ? -1 : 1),
              likedByUser: !currentLikedStatus,
            };
          }
          return post;
        })
      }));
      
      // Update with optimistic data
      mutate(optimisticData, false);
      
      // Actually perform the update
      await togglePostLike(postId, user.uid, currentLikedStatus);
      
      // If needed, revalidate after the action is complete
      // mutate(); // Uncomment if you want to revalidate
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert the optimistic update on error
      mutate();
    }
  }, [user, feedPages, mutate]);
  
  return {
    posts,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    isValidating,
    error,
    loadMore,
    refresh,
    toggleLike
  };
}
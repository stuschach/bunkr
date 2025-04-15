// src/lib/hooks/useFeed.ts
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { 
  getFeedForUser, 
  togglePostLike, 
  fetchPostDetails,
  addCommentToPost,
  checkForNewPosts 
} from '@/lib/firebase/feed-service';
import { Post, FeedQueryResult } from '@/types/post';
import { useAuth } from '@/lib/contexts/AuthContext';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { cacheService } from '@/lib/services/CacheService';

interface UseFeedOptions {
  contentTypeFilter?: 'all' | 'posts' | 'rounds' | 'tee-times';
  pageSize?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  pollInterval?: number; // New option for controlling polling frequency
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Define the proper key typing for SWR
type GetKeyType = (pageIndex: number, previousPageData: FeedQueryResult | null) => string | null;

// Define the fetcher function type
type FetcherType = (key: string) => Promise<FeedQueryResult>;

// Updated to support new post detection without auto-loading
export function useFeed({
  contentTypeFilter = 'all',
  pageSize = 5,
  revalidateOnFocus = true,
  revalidateOnReconnect = true,
  pollInterval = 60000 // Default: check for new posts every minute
}: UseFeedOptions = {}) {
  const { user } = useAuth();
  const [error, setError] = useState<Error | null>(null);
  const { notifyLike, notifyComment } = useNotificationCreator();
  
  // Track active post subscriptions - these will be managed by PostListener component
  const postSubscriptions = useRef<Map<string, () => void>>(new Map());
  
  // Track local post states for optimistic updates
  const [localPostStates, setLocalPostStates] = useState<Map<string, Partial<Post>>>(new Map());
  
  // Track pending actions
  const [pendingActions, setPendingActions] = useState<Map<string, string>>(new Map());
  
  // NEW: Track toggle intent for like operations
  const toggleIntentRef = useRef<Map<string, boolean>>(new Map());
  
  // Store the lastVisible documents for each page
  const lastVisibleDocsRef = useRef<Map<number, QueryDocumentSnapshot<DocumentData>>>(new Map());
  
  // Track which posts are visible for potential listener optimization
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  
  // New state for tracking new posts
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [newPosts, setNewPosts] = useState<Post[]>([]);
  const lastFetchTimeRef = useRef<Date>(new Date());
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingPaused = useRef<boolean>(false);
  
  // Cache key for the current feed
  const feedCacheKey = useMemo(() => {
    if (!user) return null;
    return `feed-${user.uid}-${contentTypeFilter}`;
  }, [user, contentTypeFilter]);
  
  // Fetch key generator for SWR infinite loading
  const getKey: GetKeyType = (pageIndex, previousPageData) => {
    // If no user or we've reached the end, return null
    if (!user || (previousPageData && !previousPageData.hasMore)) return null;
    
    // First page - no previousPageData
    if (pageIndex === 0) return `feed-${user.uid}-${contentTypeFilter}-0`;
    
    // Include the page index for pagination
    return `feed-${user.uid}-${contentTypeFilter}-${pageIndex}`;
  };
  
  // Custom fetcher that handles Firestore pagination and caching
  const fetcher: FetcherType = async (key) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Parse the key to get pagination info
      const parts = key.split('-');
      const pageIndex = parseInt(parts[parts.length - 1] || '0');
      
      // For first page, try to get from cache first (only on client)
      if (pageIndex === 0 && feedCacheKey && isBrowser) {
        try {
          const cachedResult = await cacheService.get<FeedQueryResult>(feedCacheKey);
          if (cachedResult) {
            console.log('Retrieved feed from cache');
            // Populate lastVisible from cache for pagination
            if (cachedResult.lastVisible) {
              lastVisibleDocsRef.current.set(0, cachedResult.lastVisible);
            }
            return cachedResult;
          }
        } catch (error) {
          console.warn('Error accessing cache, fetching fresh data:', error);
        }
      }
      
      // Get the lastVisible document if needed
      let lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
      if (pageIndex > 0) {
        lastVisible = lastVisibleDocsRef.current.get(pageIndex - 1) || null;
      }
      
      // Fetch from Firestore
      const result = await getFeedForUser(
        user.uid,
        contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times',
        lastVisible,
        pageSize
      );
      
      // Update last fetch time
      lastFetchTimeRef.current = new Date();
      
      // Store the lastVisible document for the next page
      if (result.lastVisible) {
        lastVisibleDocsRef.current.set(pageIndex, result.lastVisible);
      }
      
      // Cache the first page result (only on client)
      if (pageIndex === 0 && feedCacheKey && isBrowser) {
        try {
          cacheService.set(feedCacheKey, result, {
            ttl: 5 * 60 * 1000 // 5 minute TTL for feed data
          });
        } catch (error) {
          console.warn('Error writing to cache:', error);
        }
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
  const posts = useMemo(() => {
    if (!feedPages) return [];
    
    return feedPages.flatMap(page => page.posts)
      .filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      );
  }, [feedPages]);
  
  // Apply any local state overrides to posts
  const postsWithLocalState = useMemo(() => {
    return posts.map(post => {
      const localState = localPostStates.get(post.id);
      if (localState) {
        return { ...post, ...localState };
      }
      return post;
    });
  }, [posts, localPostStates]);
  
  // Add pending action state to posts
  const postsWithPendingState = useMemo(() => {
    return postsWithLocalState.map(post => {
      const action = pendingActions.get(post.id);
      
      return {
        ...post,
        pendingLike: action === 'like',
        pendingComment: action === 'comment',
      };
    });
  }, [postsWithLocalState, pendingActions]);
  
  // Set the error from SWR if there is one
  useEffect(() => {
    if (swrError) {
      setError(swrError instanceof Error ? swrError : new Error(String(swrError)));
    }
  }, [swrError]);
  
  // Clear lastVisibleDocs when contentTypeFilter changes
  useEffect(() => {
    lastVisibleDocsRef.current.clear();
    
    // Also clear cache for the previous feed (only on client)
    if (feedCacheKey && isBrowser) {
      try {
        cacheService.remove(feedCacheKey);
      } catch (error) {
        console.warn('Error clearing cache:', error);
      }
    }
  }, [contentTypeFilter, feedCacheKey]);
  
  // Function to track post visibility for optimization
  const handlePostVisibility = useCallback((postId: string, isVisible: boolean) => {
    setVisiblePostIds(prev => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });
  }, []);
  
  // New function to check for new posts
  const checkNewPosts = useCallback(async () => {
    if (!user || isPollingPaused.current) return;
    
    try {
      // Use the last fetch time to check for newer posts
      const result = await checkForNewPosts(
        user.uid,
        contentTypeFilter as 'all' | 'posts' | 'rounds' | 'tee-times',
        lastFetchTimeRef.current
      );
      
      if (result.count > 0) {
        setNewPostsCount(result.count);
        setNewPosts(result.posts);
      }
    } catch (error) {
      console.error('Error checking for new posts:', error);
    }
  }, [user, contentTypeFilter]);
  
  // Setup polling for new posts
  useEffect(() => {
    // Skip if no user or polling interval is 0
    if (!user || pollInterval <= 0) return;
    
    // Clear any existing interval
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    
    // Set up new polling
    const pollForNewPosts = () => {
      checkNewPosts().finally(() => {
        // Schedule next poll only if component is still mounted
        pollingTimeoutRef.current = setTimeout(pollForNewPosts, pollInterval);
      });
    };
    
    // Start polling
    pollingTimeoutRef.current = setTimeout(pollForNewPosts, pollInterval);
    
    // Cleanup on unmount
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [user, pollInterval, checkNewPosts]);
  
  // Pause polling when tab is inactive (to save battery/resources)
  useEffect(() => {
    if (!isBrowser) return;
    
    const handleVisibilityChange = () => {
      isPollingPaused.current = document.hidden;
      
      // If becoming visible again, immediately check for new posts
      if (!document.hidden && user) {
        checkNewPosts();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, checkNewPosts]);
  
  // Function to load more posts
  const loadMore = useCallback(() => {
    // Check directly inside the callback if we can load more
    if (!isValidating && feedPages && feedPages[feedPages.length - 1]?.hasMore) {
      setSize(size + 1);
    }
  }, [size, setSize, isValidating, feedPages]);
  
  // Function to load new posts (when user clicks the notification)
  const loadNewPosts = useCallback(() => {
    if (newPosts.length === 0) return;
    
    // Merge new posts with existing posts
    const mergedPosts = [...newPosts, ...postsWithPendingState];
    
    // Create a synthetic result to update the cache
    if (feedPages && feedPages.length > 0 && feedCacheKey && isBrowser) {
      const firstPage = { 
        ...feedPages[0],
        posts: mergedPosts.slice(0, pageSize)
      };
      
      // Update the cache
      try {
        cacheService.set(feedCacheKey, firstPage, {
          ttl: 5 * 60 * 1000 // 5 minute TTL
        });
      } catch (error) {
        console.warn('Error updating cache with new posts:', error);
      }
    }
    
    // Update the last fetch time
    lastFetchTimeRef.current = new Date();
    
    // Reset new posts count and cache
    setNewPostsCount(0);
    setNewPosts([]);
    
    // Revalidate data to ensure UI is updated
    mutate();
  }, [newPosts, postsWithPendingState, feedPages, feedCacheKey, pageSize, mutate]);
  
  // Function to refresh the feed
  const refresh = useCallback(() => {
    // Clear the lastVisibleDocs when refreshing
    lastVisibleDocsRef.current.clear();
    
    // Clear cache for the current feed (only on client)
    if (feedCacheKey && isBrowser) {
      try {
        cacheService.remove(feedCacheKey);
      } catch (error) {
        console.warn('Error clearing cache:', error);
      }
    }
    
    // Clear local post states
    setLocalPostStates(new Map());
    
    // Clear pending actions
    setPendingActions(new Map());
    
    // Clear new posts
    setNewPostsCount(0);
    setNewPosts([]);
    
    // Update the last fetch time
    lastFetchTimeRef.current = new Date();
    
    // Revalidate all data
    mutate();
  }, [mutate, feedCacheKey]);
  
  // Toggle like for a post with optimistic UI and robust error handling
  // UPDATED: Implements Toggle State Intent pattern and notification integration
  const toggleLike = useCallback(async (postId: string, currentLikedStatus: boolean) => {
    if (!user) return;
    
    // Find the post to get its details
    const post = postsWithLocalState.find(p => p.id === postId);
    if (!post) {
      console.error('Post not found:', postId);
      return;
    }
    
    // NEW: Get current pending action state
    const pendingAction = pendingActions.get(postId);
    const isAlreadyPending = pendingAction === 'like';
    
    // NEW: If there's already a pending operation, just update the intent
    if (isAlreadyPending) {
      // Track the intended toggle state, but don't start a new request
      setLocalPostStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(postId) || {};
        
        // Toggle the optimistic state regardless of pending state
        newMap.set(postId, {
          ...currentState,
          likes: (post.likes || 0) + (currentLikedStatus ? -1 : 1),
          likedByUser: !currentLikedStatus,
        });
        
        return newMap;
      });
      
      // NEW: Store the user's latest intent
      toggleIntentRef.current.set(postId, !currentLikedStatus);
      
      return !currentLikedStatus; // Return the new intended state immediately
    }
    
    // If not already pending, proceed with the normal flow but track intent
    try {
      // Mark action as pending
      setPendingActions(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, 'like');
        return newMap;
      });
      
      // NEW: Initialize the intent tracking
      toggleIntentRef.current.set(postId, !currentLikedStatus);
      
      // Update local state immediately for optimistic UI
      setLocalPostStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(postId) || {};
        
        newMap.set(postId, {
          ...currentState,
          likes: (post.likes || 0) + (currentLikedStatus ? -1 : 1),
          likedByUser: !currentLikedStatus,
        });
        
        return newMap;
      });
      
      // Update local cache optimistically (only on client)
      if (isBrowser) {
        try {
          const postCacheKey = `post-${postId}`;
          const cachedPost = await cacheService.get<Post>(postCacheKey);
          
          if (cachedPost) {
            // Update cached post
            const postToCache = {
              ...cachedPost,
              likes: (cachedPost.likes || 0) + (currentLikedStatus ? -1 : 1),
              likedByUser: !currentLikedStatus,
            };
            
            // Update cache
            await cacheService.set(postCacheKey, postToCache);
          }
        } catch (error) {
          console.warn('Error updating cache:', error);
        }
      }
      
      console.log(`Toggling like for post ${postId} (current status: ${currentLikedStatus})`);
      
      // Actually perform the update with retries
      const newLikedStatus = await togglePostLike(postId, user.uid, currentLikedStatus);
      console.log(`Like operation completed for post ${postId}. New status: ${newLikedStatus}`);
      
      // After completion, check if the intent changed while we were waiting
      const latestIntent = toggleIntentRef.current.get(postId);
      
      if (latestIntent !== undefined && latestIntent !== newLikedStatus) {
        // Intent changed - start a new operation with the latest intent
        console.log(`Intent changed during operation, initiating new toggle to ${latestIntent}`);
        
        // We'll start a new operation but clear the current pending state first
        setPendingActions(prev => {
          const newMap = new Map(prev);
          newMap.delete(postId);
          return newMap;
        });
        
        // Start a new toggle operation after a short delay
        setTimeout(() => {
          toggleLike(postId, !latestIntent);
        }, 10);
      } else {
        // Update local state with the actual status from server
        setLocalPostStates(prev => {
          const newMap = new Map(prev);
          const currentState = newMap.get(postId) || {};
          
          // Use the returned status from the server to ensure correctness
          const serverLikes = post.likes + (newLikedStatus ? 1 : -1);
          
          newMap.set(postId, {
            ...currentState,
            likes: serverLikes,
            likedByUser: newLikedStatus,
          });
          
          return newMap;
        });
        
        // Update cache after operation completes (only on client)
        if (isBrowser) {
          try {
            const updatedPost = await fetchPostDetails(postId);
            if (updatedPost) {
              const postCacheKey = `post-${postId}`;
              await cacheService.set(postCacheKey, updatedPost);
            }
          } catch (error) {
            console.warn('Error updating cache after like operation:', error);
          }
        }
        
        // Send notification only when liking, not unliking
        if (newLikedStatus && post.authorId !== user.uid) {
          // Determine the post type for a more specific notification
          let postTypeHint = "post";
          let notificationContent = "";
          
          if (post.postType === 'round') {
            postTypeHint = "round";
            notificationContent = `Round at ${post.courseName || 'golf course'}`;
          } 
          else if (post.postType === 'tee-time') {
            postTypeHint = "tee time";
            notificationContent = `Tee time at ${post.courseName || 'golf course'}`;
          }
          else if (post.media && post.media.length > 0) {
            // This is a media post
            postTypeHint = post.media[0].type === 'image' ? "photo" : "video";
            notificationContent = post.content || `${post.author?.displayName || 'User'}'s ${postTypeHint}`;
          }
          else {
            // Regular text post
            notificationContent = post.content || "post";
          }
          
          console.log(`Sending like notification for ${postTypeHint}`);
          
          try {
            // Send notification with post type-specific content
            await notifyLike(postId, post.authorId, notificationContent);
          } catch (notifyError) {
            console.error('Error sending notification:', notifyError);
            // Don't fail the whole operation if notification fails
          }
        }
      }
      
      // Return the new status
      return newLikedStatus;
    } catch (err) {
      console.error('Error toggling like:', err);
      
      // Revert the optimistic update on error
      setLocalPostStates(prev => {
        const newMap = new Map(prev);
        const post = postsWithLocalState.find(p => p.id === postId);
        
        if (post) {
          newMap.set(postId, {
            likes: post.likes,
            likedByUser: currentLikedStatus
          });
        } else {
          newMap.delete(postId);
        }
        
        return newMap;
      });
      
      // Revert cache update on error (only on client)
      if (isBrowser) {
        try {
          const postCacheKey = `post-${postId}`;
          const cachedPost = await cacheService.get<Post>(postCacheKey);
          
          if (cachedPost) {
            // Revert cached post
            cachedPost.likes = (cachedPost.likes || 0) + (currentLikedStatus ? 1 : -1); // Reverse the change
            cachedPost.likedByUser = currentLikedStatus;
            
            // Update cache
            await cacheService.set(postCacheKey, cachedPost);
          }
        } catch (error) {
          console.warn('Error reverting cache update on error:', error);
        }
      }
    } finally {
      // NEW: Only clear pending state if intent hasn't changed
      const latestIntent = toggleIntentRef.current.get(postId);
      const currentLocalState = localPostStates.get(postId)?.likedByUser;
      
      if (latestIntent === currentLocalState) {
        setPendingActions(prev => {
          const newMap = new Map(prev);
          newMap.delete(postId);
          return newMap;
        });
        toggleIntentRef.current.delete(postId);
      }
    }
  }, [user, postsWithLocalState, notifyLike]);
  
  // Add a comment to a post with notification integration
  const addComment = useCallback(async (
    postId: string,
    commentText: string,
    onSuccess?: (commentId: string) => void
  ) => {
    if (!user || !commentText.trim()) return;
    
    // Skip if already pending
    if (pendingActions.has(postId)) return;
    
    try {
      // Find the post to get its details
      const post = postsWithLocalState.find(p => p.id === postId);
      if (!post) {
        console.error('Post not found:', postId);
        return;
      }
      
      // Mark action as pending
      setPendingActions(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, 'comment');
        return newMap;
      });
      
      // Update local state immediately for optimistic UI
      setLocalPostStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(postId) || {};
        
        newMap.set(postId, {
          ...currentState,
          comments: (post.comments || 0) + 1
        });
        
        return newMap;
      });
      
      // Update local cache optimistically (only on client)
      if (isBrowser) {
        try {
          const postCacheKey = `post-${postId}`;
          const cachedPost = await cacheService.get<Post>(postCacheKey);
          
          if (cachedPost) {
            // Update cached post
            const postToCache = {
              ...cachedPost,
              comments: (cachedPost.comments || 0) + 1
            };
            
            // Update cache
            await cacheService.set(postCacheKey, postToCache);
          }
        } catch (error) {
          console.warn('Error updating cache for comment:', error);
        }
      }
      
      // Actually add the comment
      const commentId = await addCommentToPost(postId, user.uid, commentText);
      
      // Update cache after operation completes (only on client)
      if (isBrowser) {
        try {
          const updatedPost = await fetchPostDetails(postId);
          if (updatedPost) {
            const postCacheKey = `post-${postId}`;
            await cacheService.set(postCacheKey, updatedPost);
          }
        } catch (error) {
          console.warn('Error updating cache after comment operation:', error);
        }
      }
      
      // Send notification if commenting on someone else's post
      if (post.authorId !== user.uid) {
        try {
          // Determine post type and content for notification
          let postTypeHint = "post";
          let notificationContent = "";
          
          if (post.postType === 'round') {
            postTypeHint = "round";
            notificationContent = `Round at ${post.courseName || 'golf course'}`;
          } 
          else if (post.postType === 'tee-time') {
            postTypeHint = "tee time";
            notificationContent = `Tee time at ${post.courseName || 'golf course'}`;
          }
          else if (post.media && post.media.length > 0) {
            postTypeHint = post.media[0].type === 'image' ? "photo" : "video";
            notificationContent = post.content || `${post.author?.displayName || 'User'}'s ${postTypeHint}`;
          }
          else {
            notificationContent = post.content || "post";
          }
          
          await notifyComment(postId, post.authorId, commentText, notificationContent);
          console.log(`Comment notification sent to ${post.authorId}`);
        } catch (notifyError) {
          console.error('Error sending comment notification:', notifyError);
          // Continue even if notification fails
        }
      }
      
      // Check for @mentions in the comment
      const mentionRegex = /@(\w+)/g;
      let match;
      const mentionedUsers = new Set<string>();
      
      while ((match = mentionRegex.exec(commentText)) !== null) {
        const username = match[1];
        // Here you would need to resolve usernames to user IDs
        // This is just a placeholder for the concept
        try {
          // const userId = await getUserIdByUsername(username);
          // if (userId && userId !== user.uid && userId !== post.authorId) {
          //   mentionedUsers.add(userId);
          // }
        } catch (error) {
          console.error(`Error resolving username ${username}:`, error);
        }
      }
      
      // Notify mentioned users
      // for (const mentionedUserId of mentionedUsers) {
      //   try {
      //     await notifyMention(mentionedUserId, postId, 'comment', commentText);
      //   } catch (error) {
      //     console.error(`Error sending mention notification to ${mentionedUserId}:`, error);
      //   }
      // }
      
      // Notify callback if provided
      if (onSuccess) {
        onSuccess(commentId);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      
      // Revert the optimistic update on error
      setLocalPostStates(prev => {
        const newMap = new Map(prev);
        const post = postsWithLocalState.find(p => p.id === postId);
        
        if (post) {
          newMap.set(postId, {
            comments: post.comments
          });
        } else {
          newMap.delete(postId);
        }
        
        return newMap;
      });
      
      // Revert cache update on error (only on client)
      if (isBrowser) {
        try {
          const postCacheKey = `post-${postId}`;
          const cachedPost = await cacheService.get<Post>(postCacheKey);
          
          if (cachedPost) {
            // Revert cached post
            cachedPost.comments = (cachedPost.comments || 0) - 1; // Reverse the change
            
            // Update cache
            await cacheService.set(postCacheKey, cachedPost);
          }
        } catch (error) {
          console.warn('Error reverting cache update for comment on error:', error);
        }
      }
    } finally {
      // Clear pending status
      setPendingActions(prev => {
        const newMap = new Map(prev);
        newMap.delete(postId);
        return newMap;
      });
    }
  }, [user, postsWithLocalState, pendingActions, notifyComment]);
  
  // Calculate loading states
  const isLoadingInitial = !feedPages && !swrError;
  const isLoadingMore = isValidating || (size > 0 && feedPages && typeof feedPages[size - 1] === 'undefined');
  
  return {
    posts: postsWithPendingState,
    hasMore: feedPages ? feedPages[feedPages.length - 1]?.hasMore : true,
    isLoadingInitial,
    isLoadingMore,
    isValidating,
    error,
    loadMore,
    refresh,
    toggleLike,
    addComment,
    handlePostVisibility,
    pendingActions: Array.from(pendingActions.keys()),
    visiblePostIds,
    handlePostVisibility,
    
    // New post notification properties
    newPostsCount,
    loadNewPosts,
    
    // Poll control for testing
    pausePolling: () => { isPollingPaused.current = true; },
    resumePolling: () => { isPollingPaused.current = false; }
  };
}
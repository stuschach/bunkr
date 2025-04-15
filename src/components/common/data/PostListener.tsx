// src/components/common/data/PostListener.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Post } from '@/types/post';
import { subscribeToPost } from '@/lib/firebase/feed-service';
import { useVisibility } from '@/lib/contexts/VisibilityContext';
import { cacheService } from '@/lib/services/CacheService';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

interface PostListenerProps {
  postId: string;
  initialData: Post;
  isVisible?: boolean;
  children: (post: Post, isLoading: boolean) => React.ReactNode;
  priority?: number; // 1-10, higher = more important to keep active
  onDeleted?: () => void; // New callback for when a post is detected as deleted
}

/**
 * A component that manages real-time subscriptions to post data
 * Optimizes Firestore usage by only subscribing when posts are visible
 */
export function PostListener({
  postId,
  initialData,
  isVisible = true,
  children,
  priority = 5,
  onDeleted
}: PostListenerProps) {
  // Create a ref to the post element for visibility tracking
  const postRef = useRef<HTMLDivElement>(null);
  
  // Track post data
  const [postData, setPostData] = useState<Post>(initialData);
  
  // Track if the post has been deleted
  const [isDeleted, setIsDeleted] = useState<boolean>(false);
  
  // Track subscription loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Keep track of unsubscribe function
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Use global visibility manager (will be available through context)
  const { registerPost } = useVisibility();

  // Effect to register this post for visibility tracking
  useEffect(() => {
    if (postRef.current) {
      const cleanup = registerPost(postId, postRef.current);
      return cleanup;
    }
  }, [postId, registerPost]);

  // Effect to subscribe/unsubscribe based on visibility
  useEffect(() => {
    let isMounted = true;
    
    const setupSubscription = async () => {
      // Skip subscription if post is already known to be deleted
      if (isDeleted) return;
      
      // Only set up subscription if visible
      if (!isVisible) {
        // Clean up existing subscription if there is one
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        return;
      }
      
      // Check if we already have a subscription
      if (unsubscribeRef.current) return;
      
      setIsLoading(true);
      
      // Try to get cached data first (only on client)
      if (isBrowser) {
        try {
          const cacheKey = `post-${postId}`;
          const cachedData = await cacheService.get<Post>(cacheKey);
          
          if (cachedData && isMounted) {
            setPostData(cachedData);
          }
        } catch (error) {
          console.warn('Error retrieving from cache:', error);
        }
      }
      
      // Set up real-time listener
      console.log(`Setting up subscription for post ${postId}`);
      
      try {
        const unsubscribe = subscribeToPost(postId, (postUpdates) => {
          if (!isMounted) return;
          
          // Check if post was deleted
          if (postUpdates === null || postUpdates.isDeleted) {
            console.log(`Post ${postId} was deleted or not found`);
            setIsDeleted(true);
            setIsLoading(false);
            
            // Clear from cache
            if (isBrowser) {
              cacheService.remove(`post-${postId}`);
            }
            
            // Call the onDeleted callback if provided
            if (onDeleted) {
              onDeleted();
            }
            
            return;
          }
          
          setPostData(prev => {
            const updatedPost = { ...prev, ...postUpdates };
            
            // Cache the updated data (only on client)
            if (isBrowser) {
              try {
                const cacheKey = `post-${postId}`;
                cacheService.set(cacheKey, updatedPost, {
                  ttl: 30 * 60 * 1000 // 30 minutes TTL
                });
              } catch (error) {
                console.warn('Error writing to cache:', error);
              }
            }
            
            return updatedPost;
          });
          
          setIsLoading(false);
        });
        
        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        console.error(`Error setting up subscription for post ${postId}:`, error);
        setIsLoading(false);
        
        // Check if the error is because the post doesn't exist
        if (error.message && error.message.includes('not found')) {
          setIsDeleted(true);
          if (onDeleted) {
            onDeleted();
          }
        }
      }
    };
    
    setupSubscription();
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      // Clean up subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [postId, isVisible, isDeleted, onDeleted]);

  // If the post is deleted, don't render anything
  if (isDeleted) {
    return null;
  }

  return (
    <div ref={postRef} data-post-id={postId}>
      {children(postData, isLoading)}
    </div>
  );
}
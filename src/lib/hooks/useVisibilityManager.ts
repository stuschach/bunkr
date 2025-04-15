// src/lib/hooks/useVisibilityManager.ts
import { useCallback, useEffect, useRef, useState } from 'react';

interface VisibilityManagerOptions {
  // How long to keep listeners active after a post leaves the viewport (ms)
  bufferTime?: number;
  // Enable or disable the manager
  enabled?: boolean;
  // Callback when visibility changes
  onVisibilityChange?: (id: string, isVisible: boolean) => void;
}

/**
 * A hook to manage post visibility and listeners efficiently
 * This helps reduce Firestore costs by only activating listeners for visible posts
 */
export function useVisibilityManager(options: VisibilityManagerOptions = {}) {
  const {
    bufferTime = 5000, // 5 seconds by default
    enabled = true,
    onVisibilityChange
  } = options;

  // Track which posts are visible in the viewport
  const [visiblePosts, setVisiblePosts] = useState<Set<string>>(new Set());
  
  // Track which posts have active listeners
  const [activePosts, setActivePosts] = useState<Set<string>>(new Set());
  
  // Store timeouts for posts that left the viewport
  const postTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Observed elements map to track which elements are being observed
  const observedElements = useRef<Map<string, HTMLElement>>(new Map());
  
  // Intersection Observer reference
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create the intersection observer
  useEffect(() => {
    if (!enabled) return;

    // Create an observer to track post visibility
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Process each intersection entry
        entries.forEach(entry => {
          const postId = entry.target.getAttribute('data-post-id');
          if (!postId) return;
          
          // Check if the post is now visible
          if (entry.isIntersecting) {
            // Clear any existing timeout for this post
            if (postTimeouts.current.has(postId)) {
              clearTimeout(postTimeouts.current.get(postId)!);
              postTimeouts.current.delete(postId);
            }
            
            // Add to visible posts
            setVisiblePosts(prev => {
              const newSet = new Set(prev);
              newSet.add(postId);
              return newSet;
            });
            
            // Add to active posts
            setActivePosts(prev => {
              const newSet = new Set(prev);
              newSet.add(postId);
              return newSet;
            });
            
            // Call the visibility change callback
            if (onVisibilityChange) {
              onVisibilityChange(postId, true);
            }
          } else {
            // Remove from visible posts
            setVisiblePosts(prev => {
              const newSet = new Set(prev);
              newSet.delete(postId);
              return newSet;
            });
            
            // Set a timeout to remove from active posts after buffer time
            if (!postTimeouts.current.has(postId)) {
              const timeoutId = setTimeout(() => {
                setActivePosts(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(postId);
                  return newSet;
                });
                
                postTimeouts.current.delete(postId);
                
                // Call the visibility change callback
                if (onVisibilityChange) {
                  onVisibilityChange(postId, false);
                }
              }, bufferTime);
              
              postTimeouts.current.set(postId, timeoutId);
            }
          }
        });
      },
      {
        // Start observing when at least 10% of the element is visible
        threshold: 0.1,
        // Start observing when the element is within 200px of the viewport
        rootMargin: '200px'
      }
    );
    
    // Observe any elements that were added before the observer was created
    observedElements.current.forEach((element, postId) => {
      observerRef.current?.observe(element);
    });
    
    // Cleanup function
    return () => {
      // Clear all timeouts
      postTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      postTimeouts.current.clear();
      
      // Disconnect the observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [enabled, bufferTime, onVisibilityChange]);
  
  // Register a post element to be observed for visibility
  const registerPost = useCallback((postId: string, element: HTMLElement | null) => {
    if (!enabled || !element) return;
    
    // Set the data attribute for the post ID
    element.setAttribute('data-post-id', postId);
    
    // Store the element for observation
    observedElements.current.set(postId, element);
    
    // Start observing if the observer exists
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
    
    // Return a cleanup function
    return () => {
      // Remove the element from observation
      if (observerRef.current) {
        observerRef.current.unobserve(element);
      }
      
      // Remove from observed elements
      observedElements.current.delete(postId);
      
      // Clear any timeouts
      if (postTimeouts.current.has(postId)) {
        clearTimeout(postTimeouts.current.get(postId)!);
        postTimeouts.current.delete(postId);
      }
      
      // Remove from active posts
      setActivePosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
      
      // Remove from visible posts
      setVisiblePosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    };
  }, [enabled]);
  
  // Check if a post is currently visible
  const isPostVisible = useCallback((postId: string) => {
    return visiblePosts.has(postId);
  }, [visiblePosts]);
  
  // Check if a post has an active listener
  const isPostActive = useCallback((postId: string) => {
    return activePosts.has(postId);
  }, [activePosts]);
  
  // Force a post to be active (useful for posts that are being interacted with)
  const forcePostActive = useCallback((postId: string) => {
    // Clear any existing timeout
    if (postTimeouts.current.has(postId)) {
      clearTimeout(postTimeouts.current.get(postId)!);
      postTimeouts.current.delete(postId);
    }
    
    // Add to active posts
    setActivePosts(prev => {
      const newSet = new Set(prev);
      newSet.add(postId);
      return newSet;
    });
  }, []);
  
  // Stats for debugging and monitoring
  const stats = {
    visibleCount: visiblePosts.size,
    activeCount: activePosts.size,
    observedCount: observedElements.current.size
  };

  return {
    registerPost,
    isPostVisible,
    isPostActive,
    forcePostActive,
    visiblePosts,
    activePosts,
    stats
  };
}
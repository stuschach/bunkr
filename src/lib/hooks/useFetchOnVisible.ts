// src/hooks/useFetchOnVisible.ts
// Hook for loading data when an element is visible

import { useRef, useEffect, useCallback } from 'react';

interface UseFetchOnVisibleOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  enabled?: boolean;
}

export function useFetchOnVisible(
  callback: () => void,
  options: UseFetchOnVisibleOptions = {}
): React.RefObject<HTMLDivElement> {
  const { 
    root = null, 
    rootMargin = '0px', 
    threshold = 0.1,
    enabled = true
  } = options;
  
  const targetRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  // Set up the intersection observer
  useEffect(() => {
    if (!enabled) return undefined;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          callbackRef.current();
        }
      },
      { root, rootMargin, threshold }
    );
    
    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [root, rootMargin, threshold, enabled]);
  
  return targetRef;
}
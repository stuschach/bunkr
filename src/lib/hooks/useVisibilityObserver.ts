// src/lib/hooks/useVisibilityObserver.ts
import { useRef, useEffect, useState, useCallback } from 'react';

interface VisibilityObserverOptions {
  threshold?: number;
  rootMargin?: string;
  root?: Element | null;
  onVisibilityChange?: (id: string, isVisible: boolean) => void;
}

/**
 * A hook that provides element visibility tracking in the viewport
 * with optimized intersection observer management
 */
export function useVisibilityObserver({
  threshold = 0.2,
  rootMargin = '200px 0px', // Preload posts that are about to enter the viewport
  root = null,
  onVisibilityChange
}: VisibilityObserverOptions = {}) {
  // Ref to store the current observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Map of element refs to their IDs
  const elementRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  
  // Map to track visibility state - using ref to avoid re-renders
  const visibilityMapRef = useRef<Map<string, boolean>>(new Map());
  const [visibilityState, setVisibilityState] = useState<Map<string, boolean>>(new Map());
  
  // Flag to prevent updates during render
  const isUpdatingRef = useRef(false);
  
  // Create the observer instance - only once
  useEffect(() => {
    if (observerRef.current) {
      // Disconnect existing observer before creating a new one
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isUpdatingRef.current) return;
        isUpdatingRef.current = true;
        
        // Process all entries in this batch
        let hasChanges = false;
        
        entries.forEach(entry => {
          const element = entry.target as HTMLElement;
          const id = element.dataset.id;
          
          if (id) {
            const isNowVisible = entry.isIntersecting;
            const wasVisible = visibilityMapRef.current.get(id) || false;
            
            // Only update if visibility changed
            if (isNowVisible !== wasVisible) {
              visibilityMapRef.current.set(id, isNowVisible);
              hasChanges = true;
              
              // Call the visibility change callback
              if (onVisibilityChange) {
                onVisibilityChange(id, isNowVisible);
              }
            }
          }
        });
        
        // Update state only if there were changes - and do it outside the loop
        if (hasChanges) {
          // Clone the map to ensure React detects the change
          setVisibilityState(new Map(visibilityMapRef.current));
        }
        
        isUpdatingRef.current = false;
      },
      { threshold, rootMargin, root }
    );
    
    // Re-observe all existing elements
    elementRefsMap.current.forEach((element) => {
      observerRef.current?.observe(element);
    });
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [threshold, rootMargin, root, onVisibilityChange]);
  
  // Function to register an element for visibility tracking - memoized
  const registerElement = useCallback((id: string, element: HTMLElement | null) => {
    // Do nothing if already registered to the same element
    const existingElement = elementRefsMap.current.get(id);
    if (existingElement === element) return;
    
    if (!element) {
      // Element was unmounted, stop observing
      if (elementRefsMap.current.has(id)) {
        const oldElement = elementRefsMap.current.get(id)!;
        observerRef.current?.unobserve(oldElement);
        elementRefsMap.current.delete(id);
        
        // Update visibility state
        if (visibilityMapRef.current.has(id)) {
          visibilityMapRef.current.delete(id);
          setVisibilityState(new Map(visibilityMapRef.current));
        }
      }
      return;
    }
    
    // Add data-id attribute for the observer callback
    element.dataset.id = id;
    
    // Store the element reference
    elementRefsMap.current.set(id, element);
    
    // Start observing
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
    
    // Set initial visibility (assume not visible until observer reports)
    if (!visibilityMapRef.current.has(id)) {
      visibilityMapRef.current.set(id, false);
      setVisibilityState(new Map(visibilityMapRef.current));
    }
  }, []);
  
  // Function to check if an element is visible
  const isElementVisible = useCallback((id: string) => {
    return visibilityMapRef.current.get(id) || false;
  }, []);
  
  return {
    registerElement,
    isElementVisible,
    visibilityMap: visibilityState
  };
}
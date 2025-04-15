// src/lib/hooks/usePullToRefresh.ts
import { useRef, useEffect, useState, RefObject } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  pullDistance?: number; // Distance needed to pull down to trigger refresh
  containerRef?: RefObject<HTMLElement>; // Explicitly use RefObject type
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  pullDistance = 80, // Default pull distance
  containerRef: externalContainerRef, // Rename to avoid shadowing
  disabled = false
}: PullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const currentPullDistance = useRef<number>(0);
  const refreshTriggered = useRef<boolean>(false);
  
  // Create default container ref if not provided
  const internalContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the external ref if provided, otherwise use our internal ref
  const targetRef = externalContainerRef || internalContainerRef;
  
  // Pull-to-refresh effect
  useEffect(() => {
    // Skip if disabled
    if (disabled) return;
    
    const container = targetRef.current;
    if (!container) return;
    
    // Handler for touch start
    const handleTouchStart = (e: Event) => {
      // Type assertion to get the correct event type
      const touchEvent = e as TouchEvent;
      
      // Only allow pull to refresh at the top of the container
      if (container.scrollTop <= 0) {
        touchStartY.current = touchEvent.touches[0].clientY;
        refreshTriggered.current = false;
        setIsPulling(true);
      }
    };
    
    // Handler for touch move
    const handleTouchMove = (e: Event) => {
      // Type assertion to get the correct event type
      const touchEvent = e as TouchEvent;
      
      if (!touchStartY.current) return;
      
      // Calculate pull distance
      const touchY = touchEvent.touches[0].clientY;
      const pullDistanceValue = touchY - touchStartY.current;
      
      // Only allow pulling down
      if (pullDistanceValue <= 0) {
        touchStartY.current = null;
        setIsPulling(false);
        setPullProgress(0);
        return;
      }
      
      // Apply resistance to the pull (gets harder as you pull further)
      const resistance = 0.4;
      const adjustedDistance = pullDistanceValue * resistance;
      
      // Update pull distance
      currentPullDistance.current = adjustedDistance;
      
      // Calculate progress percentage (0-100)
      const progress = Math.min(100, (adjustedDistance / pullDistance) * 100);
      setPullProgress(progress);
      
      // If we've pulled enough and haven't triggered refresh yet
      if (progress >= 100 && !refreshTriggered.current) {
        refreshTriggered.current = true;
      }
    };
    
    // Handler for touch end
    const handleTouchEnd = async () => {
      if (!touchStartY.current) return;
      
      touchStartY.current = null;
      setIsPulling(false);
      
      // If we've pulled enough, trigger refresh
      if (refreshTriggered.current) {
        setIsRefreshing(true);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Error during refresh:', error);
        } finally {
          setIsRefreshing(false);
          refreshTriggered.current = false;
        }
      }
      
      // Reset pull distance and progress
      currentPullDistance.current = 0;
      setPullProgress(0);
    };
    
    // Add event listeners - use string event names for wider compatibility
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);
    
    // Cleanup
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, pullDistance, disabled, targetRef]);
  
  return {
    isPulling,
    pullProgress,
    isRefreshing,
    containerRef: targetRef
  };
}
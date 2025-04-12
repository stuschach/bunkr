// src/lib/hooks/useFollow.ts
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useFollowContext } from '@/lib/contexts/FollowContext';

interface UseFollowParams {
  targetUserId: string;
  onFollowChange?: (isFollowing: boolean) => void;
  onCountChange?: (count: number) => void;
}

export function useFollow({ targetUserId, onFollowChange, onCountChange }: UseFollowParams) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { notifyFollow } = useNotificationCreator();
  const { 
    toggleFollow: contextToggleFollow, 
    isFollowing: getIsFollowing,
    isLoading: getIsLoading,
    getFollowerCount,
    refreshFollowState
  } = useFollowContext();
  
  const [isHovered, setIsHovered] = useState(false);
  
  // Initialize follow state when the hook mounts
  useEffect(() => {
    if (user && targetUserId && user.uid !== targetUserId) {
      refreshFollowState(targetUserId);
    }
  }, [user, targetUserId, refreshFollowState]);
  
  // Get current states from context
  const isFollowing = getIsFollowing(targetUserId);
  const isLoading = getIsLoading(targetUserId);
  const followerCount = getFollowerCount(targetUserId);
  
  // Toggle follow status with fixed implementation
  const toggleFollow = useCallback(async () => {
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Authentication Required',
        description: 'You must be logged in to follow users.'
      });
      return;
    }
    
    if (user.uid === targetUserId) {
      showNotification({
        type: 'info',
        title: 'Action Not Allowed',
        description: 'You cannot follow yourself.'
      });
      return;
    }
    
    try {
      // Get previous state for comparison
      const wasFollowing = getIsFollowing(targetUserId);
      
      // Toggle follow status and get the ACTUAL result from Firebase
      const result = await contextToggleFollow(targetUserId);
      
      // Use the result from the operation, not a second local check
      const isNowFollowing = result.isFollowing;
      const newFollowerCount = result.followerCount;
      
      // Notify parent components if state changed
      if (wasFollowing !== isNowFollowing) {
        if (onFollowChange) {
          onFollowChange(isNowFollowing);
        }
        
        if (onCountChange) {
          onCountChange(newFollowerCount);
        }
        
        // Send follow notification if appropriate
        if (isNowFollowing && notifyFollow) {
          notifyFollow(targetUserId);
        }
        
        // Show success notification based on the ACTUAL NEW STATE
        showNotification({
          type: 'success',
          title: isNowFollowing ? 'Following' : 'Unfollowed',
          description: isNowFollowing 
            ? 'You are now following this user.' 
            : 'You have unfollowed this user.'
        });
      }
    } catch (error) {
      console.error('[useFollow] Error toggling follow status:', error);
      
      showNotification({
        type: 'error',
        title: 'Action Failed',
        description: 'Failed to update follow status. Please try again.'
      });
      
      // Force refresh state from server to ensure accuracy
      refreshFollowState(targetUserId);
    }
  }, [user, targetUserId, contextToggleFollow, getIsFollowing, onFollowChange, onCountChange, showNotification, refreshFollowState, notifyFollow]);
  
  // Helper functions for button UI remain unchanged
  const getButtonText = useCallback(() => {
    if (isFollowing) {
      return isHovered ? 'Unfollow' : 'Following';
    }
    return 'Follow';
  }, [isFollowing, isHovered]);
  
  const getButtonVariant = useCallback(() => {
    if (isFollowing) {
      return isHovered ? 'destructive' : 'outline';
    }
    return 'primary';
  }, [isFollowing, isHovered]);
  
  return {
    isFollowing,
    followerCount,
    isLoading,
    toggleFollow,
    isHovered,
    setIsHovered,
    getButtonText,
    getButtonVariant
  };
}
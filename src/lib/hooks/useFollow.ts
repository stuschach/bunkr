// src/lib/hooks/useFollow.ts
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useFollowContext } from '@/lib/contexts/FollowContext';

interface UseFollowParams {
  targetUserId: string;
  onFollowChange?: (isFollowing: boolean) => void;
  onCountChange?: (count: number) => void;
}

export function useFollow({ targetUserId, onFollowChange, onCountChange }: UseFollowParams) {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  const { notifyFollow } = useNotificationCreator();
  const { 
    toggleFollow: contextToggleFollow, 
    isFollowing: checkIsFollowing,
    isLoading: checkIsLoading,
    getFollowerCount
  } = useFollowContext();

  // Local state for UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Use the context to get the current follow state
  const isFollowing = checkIsFollowing(targetUserId);

  // Toggle follow status using the robust system
  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || isLoading) return;
    
    // Skip if trying to follow self
    if (user.uid === targetUserId) {
      showNotification({
        type: 'info',
        title: 'Action not allowed',
        description: 'You cannot follow yourself'
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use the context's toggleFollow method
      const result = await contextToggleFollow(targetUserId);
      
      // Show appropriate notification
      if (result.isFollowing) {
        await notifyFollow(targetUserId);
        showNotification({
          type: 'success',
          title: 'Success',
          description: 'You are now following this user'
        });
      } else {
        showNotification({
          type: 'info',
          title: 'Success',
          description: 'You have unfollowed this user'
        });
      }
      
      // Call callback if provided
      if (onFollowChange) {
        onFollowChange(result.isFollowing);
      }
      
      // Update count if needed
      if (onCountChange) {
        onCountChange(result.followerCount);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to update follow status'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, targetUserId, isLoading, contextToggleFollow, notifyFollow, showNotification, onFollowChange, onCountChange]);

  // Helper functions for the UI
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
    return 'default';
  }, [isFollowing, isHovered]);

  return {
    isFollowing,
    isLoading: isLoading || checkIsLoading(targetUserId),
    toggleFollow,
    followerCount: getFollowerCount(targetUserId),
    isHovered,
    setIsHovered,
    getButtonText,
    getButtonVariant
  };
}
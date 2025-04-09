// src/components/profile/FollowButton.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  userId,
  isFollowing: initialIsFollowing,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const handleFollowToggle = async () => {
    if (!user) {
      showNotification({
        type: 'info',
        title: 'Sign in required',
        description: 'Please sign in to follow other users',
      });
      return;
    }

    setIsLoading(true);

    try {
      // This would be replaced with your actual follow/unfollow API call
      // await toggleFollow(userId);
      
      const newFollowState = !isFollowing;
      setIsFollowing(newFollowState);
      
      if (onFollowChange) {
        onFollowChange(newFollowState);
      }

      showNotification({
        type: 'success',
        title: newFollowState ? 'Following' : 'Unfollowed',
        description: newFollowState ? 'You are now following this user' : 'You are no longer following this user',
      });
    } catch (error) {
      console.error('Error toggling follow status:', error);
      showNotification({
        type: 'error',
        title: 'Action failed',
        description: 'Unable to update follow status. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : 'primary'}
      onClick={handleFollowToggle}
      isLoading={isLoading}
      disabled={isLoading}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}
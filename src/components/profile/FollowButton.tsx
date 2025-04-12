// src/components/profile/FollowButton.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFollow } from '@/lib/hooks/useFollow';

interface FollowButtonProps {
  userId: string;
  isFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  onCountChange?: (count: number) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function FollowButton({
  userId,
  onFollowChange,
  onCountChange,
  size = 'md',
  fullWidth = false
}: FollowButtonProps) {
  const { user } = useAuth();
  
  const { 
    isFollowing,
    isLoading,
    toggleFollow,
    isHovered,
    setIsHovered,
    getButtonText,
    getButtonVariant
  } = useFollow({
    targetUserId: userId,
    onFollowChange,
    onCountChange
  });

  return (
    <Button
      variant={getButtonVariant()}
      size={size}
      onClick={toggleFollow}
      isLoading={isLoading}
      disabled={isLoading || (user && user.uid === userId)}
      className={`transition-all duration-200 ${fullWidth ? 'w-full' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-following={isFollowing ? 'true' : 'false'}
      data-testid="follow-button"
    >
      {getButtonText()}
    </Button>
  );
}
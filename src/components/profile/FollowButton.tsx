// src/components/profile/FollowButton.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFollow } from '@/lib/hooks/useFollow';

interface FollowButtonProps {
  userId: string;
  onFollowChange?: (isFollowing: boolean) => void;
  onCountChange?: (count: number) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  variant?: 'default' | 'minimal' | 'rounded';
}

export function FollowButton({
  userId,
  onFollowChange,
  onCountChange,
  size = 'md',
  fullWidth = false,
  variant = 'default'
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

  // Custom button styles based on variant
  const getCustomStyles = () => {
    const baseStyles = "transition-all duration-300 font-medium";
    const sizeStyles = {
      sm: "text-xs py-1 px-3",
      md: "text-sm py-1.5 px-4",
      lg: "text-base py-2 px-5"
    };
    
    // Following state styles
    const followingStyles = isFollowing 
      ? isHovered 
        ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40" 
        : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40"
      : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500";

    // Different visual variants
    if (variant === 'minimal') {
      return `${baseStyles} ${sizeStyles[size]} ${isFollowing 
        ? isHovered 
          ? "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" 
          : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"}`;
    } else if (variant === 'rounded') {
      return `${baseStyles} ${sizeStyles[size]} rounded-full shadow-sm ${followingStyles}`;
    } else {
      // Default variant
      return `${baseStyles} ${sizeStyles[size]} rounded-md shadow-sm ${followingStyles}`;
    }
  };

  // Icon for the button
  const getIcon = () => {
    if (isLoading) return null;
    
    if (isFollowing) {
      return isHovered ? (
        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={toggleFollow}
        disabled={isLoading || (user && user.uid === userId)}
        className={`${getCustomStyles()} ${fullWidth ? 'w-full flex justify-center' : ''} inline-flex items-center`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-following={isFollowing ? 'true' : 'false'}
        data-testid="follow-button"
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : getIcon()}
        {getButtonText()}
      </button>
    );
  } else {
    return (
      <button
        onClick={toggleFollow}
        disabled={isLoading || (user && user.uid === userId)}
        className={`${getCustomStyles()} ${fullWidth ? 'w-full flex justify-center' : ''} inline-flex items-center border`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-following={isFollowing ? 'true' : 'false'}
        data-testid="follow-button"
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : getIcon()}
        {getButtonText()}
      </button>
    );
  }
}
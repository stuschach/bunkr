// src/lib/contexts/FollowContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { RobustFollowSystem } from '../services/robustFollowSystem';

// Define context type
type FollowContextType = {
  isFollowing: (targetUserId: string) => boolean;
  getFollowerCount: (targetUserId: string) => number;
  getFollowingCount: (targetUserId: string) => number; // Added this method
  isLoading: (targetUserId: string) => boolean;
  toggleFollow: (targetUserId: string) => Promise<{ isFollowing: boolean; followerCount: number }>;
  refreshFollowState: (targetUserId: string) => Promise<void>;
};

// Create context with default values
const FollowContext = createContext<FollowContextType>({
  isFollowing: () => false,
  getFollowerCount: () => 0,
  getFollowingCount: () => 0, // Added default
  isLoading: () => false,
  toggleFollow: async () => ({ isFollowing: false, followerCount: 0 }),
  refreshFollowState: async () => {}
});

// Define follow state type
type FollowState = {
  [userId: string]: {
    isFollowing: boolean;
    followerCount: number;
    followingCount: number; // Added followingCount
    isLoading: boolean;
  };
};

export const FollowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track follow status for various users
  const [followState, setFollowState] = useState<FollowState>({});
  const { user } = useAuth();
  
  // Track active subscriptions
  const [subscriptions, setSubscriptions] = useState<{[key: string]: () => void}>({});
  
  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      Object.values(subscriptions).forEach(unsubscribe => unsubscribe());
    };
  }, [subscriptions]);
  
  // Refresh follow state for a specific user
  const refreshFollowState = useCallback(async (targetUserId: string) => {
    if (!user || !targetUserId) return;
    
    // Set loading state
    setFollowState(prev => ({
      ...prev,
      [targetUserId]: {
        ...(prev[targetUserId] || { isFollowing: false, followerCount: 0, followingCount: 0 }),
        isLoading: true
      }
    }));
    
    try {
      // Get the current follow state from Firebase
      const { isFollowing, followerCount } = await RobustFollowSystem.getCurrentFollowState(
        user.uid,
        targetUserId
      );
      
      // Get the following count as well
      const followingCount = await RobustFollowSystem.getFollowingCount(targetUserId);
      
      // Update state with result
      setFollowState(prev => ({
        ...prev,
        [targetUserId]: {
          isFollowing,
          followerCount,
          followingCount,
          isLoading: false
        }
      }));
      
      // Setup subscription for real-time updates if not already subscribed
      if (!subscriptions[targetUserId]) {
        const unsubscribe = RobustFollowSystem.subscribeToFollowState(
          user.uid,
          targetUserId,
          (state) => {
            setFollowState(prev => ({
              ...prev,
              [targetUserId]: {
                ...state,
                followingCount: prev[targetUserId]?.followingCount || 0, // Preserve following count
                isLoading: false
              }
            }));
          }
        );
        
        // Also set up subscription for following count updates
        const followingCountUnsubscribe = RobustFollowSystem.subscribeToUserCounts(
          targetUserId,
          (counts) => {
            setFollowState(prev => ({
              ...prev,
              [targetUserId]: {
                ...prev[targetUserId],
                followingCount: counts.followingCount,
                followerCount: counts.followerCount // Update follower count too for consistency
              }
            }));
          }
        );
        
        // Combine both unsubscribe functions
        const combinedUnsubscribe = () => {
          unsubscribe();
          followingCountUnsubscribe();
        };
        
        setSubscriptions(prev => ({
          ...prev,
          [targetUserId]: combinedUnsubscribe
        }));
      }
    } catch (error) {
      console.error('Error refreshing follow state:', error);
      
      // Set error state
      setFollowState(prev => ({
        ...prev,
        [targetUserId]: {
          ...(prev[targetUserId] || { isFollowing: false, followerCount: 0, followingCount: 0 }),
          isLoading: false
        }
      }));
    }
  }, [user, subscriptions]);
  
  // Toggle follow status for a user
  const toggleFollow = useCallback(async (targetUserId: string) => {
    if (!user || !targetUserId) {
      return { isFollowing: false, followerCount: 0 };
    }
    
    // Set loading state
    setFollowState(prev => ({
      ...prev,
      [targetUserId]: {
        ...(prev[targetUserId] || { isFollowing: false, followerCount: 0, followingCount: 0 }),
        isLoading: true
      }
    }));
    
    try {
      // Perform the toggle operation
      const result = await RobustFollowSystem.toggleFollowStatus(user.uid, targetUserId);
      
      // Get the following count too
      const followingCount = await RobustFollowSystem.getFollowingCount(targetUserId);
      
      // Update local state with result
      setFollowState(prev => ({
        ...prev,
        [targetUserId]: {
          isFollowing: result.isFollowing,
          followerCount: result.followerCount,
          followingCount,
          isLoading: false
        }
      }));
      
      return result;
    } catch (error) {
      console.error('Error toggling follow status:', error);
      
      // Reset loading state on error
      setFollowState(prev => ({
        ...prev,
        [targetUserId]: {
          ...(prev[targetUserId] || { isFollowing: false, followerCount: 0, followingCount: 0 }),
          isLoading: false
        }
      }));
      
      // Return current state
      return {
        isFollowing: followState[targetUserId]?.isFollowing || false,
        followerCount: followState[targetUserId]?.followerCount || 0
      };
    }
  }, [user, followState]);
  
  // Helper functions to get state values
  const isFollowing = useCallback((targetUserId: string) => {
    return followState[targetUserId]?.isFollowing || false;
  }, [followState]);
  
  const getFollowerCount = useCallback((targetUserId: string) => {
    return followState[targetUserId]?.followerCount || 0;
  }, [followState]);
  
  const getFollowingCount = useCallback((targetUserId: string) => {
    return followState[targetUserId]?.followingCount || 0;
  }, [followState]);
  
  const isLoading = useCallback((targetUserId: string) => {
    return followState[targetUserId]?.isLoading || false;
  }, [followState]);
  
  // Context value
  const contextValue = {
    isFollowing,
    getFollowerCount,
    getFollowingCount,
    isLoading,
    toggleFollow,
    refreshFollowState
  };
  
  return (
    <FollowContext.Provider value={contextValue}>
      {children}
    </FollowContext.Provider>
  );
};

// Hook to use the follow context
export const useFollowContext = () => useContext(FollowContext);
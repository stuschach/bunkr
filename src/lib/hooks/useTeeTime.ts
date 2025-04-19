// src/lib/hooks/useTeeTime.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime as useTeeTimeContext } from '@/lib/contexts/TeeTimeContext';
import { 
  TeeTime, 
  TeeTimePlayer, 
  TeeTimeFormData,
  TeeTimeFilters
} from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { usePostCreation } from '@/lib/hooks/usePostCreation';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useToast } from '@/lib/hooks/useToast';
import { DocumentSnapshot } from 'firebase/firestore';

/**
 * A hook that combines the TeeTimeContext with additional functionality
 * This wraps the context for backward compatibility with existing components
 */
export function useTeeTime() {
  const { user } = useAuth();
  const teeTimeContext = useTeeTimeContext();
  const { createPost, isCreating: isCreatingPost } = usePostCreation();
  const notificationCreator = useNotificationCreator();
  const { showToast } = useToast();
  
  // Local states
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [isResponding, setIsResponding] = useState<Record<string, boolean>>({});
  
  // Calculate overall loading state
  const isLoading = teeTimeContext.isLoading || 
                    isCreatingPost || 
                    Object.values(isDeleting).some(Boolean) ||
                    Object.values(isResponding).some(Boolean);
  
  // Create a new tee time
  const handleCreateTeeTime = useCallback(async (teeTimeData: TeeTimeFormData): Promise<string | null> => {
    if (!user) {
      teeTimeContext.resetError();
      return null;
    }
    
    try {
      // First create the tee time entity using the context
      const teeTimeId = await teeTimeContext.createTeeTime(teeTimeData);
      
      if (!teeTimeId) {
        return null;
      }
      
      return teeTimeId;
    } catch (error) {
      console.error('Error creating tee time:', error);
      return null;
    }
  }, [user, teeTimeContext, createPost]);
  
  // Handle join request with notification
  const handleJoinRequest = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      throw new Error('You must be logged in to join a tee time');
    }
    
    try {
      // Use the context function to request to join
      const success = await teeTimeContext.joinTeeTime(teeTimeId);
      
      if (success) {
        // Get the tee time details for the notification
        const teeTimeDetails = await teeTimeContext.getTeeTimeDetails(teeTimeId);
        
        if (teeTimeDetails.teeTime?.creatorId) {
          // Send notification to creator
          await notificationCreator.sendNotification(
            teeTimeDetails.teeTime.creatorId,
            'tee-time-request',
            teeTimeId,
            'tee-time',
            {
              message: `${user.displayName || 'Someone'} has requested to join your tee time.`,
              courseName: teeTimeDetails.teeTime.courseName,
              date: teeTimeDetails.teeTime.dateTime?.toISOString() || new Date().toISOString()
            }
          );
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error requesting to join tee time:', error);
      throw error;
    }
  }, [user, teeTimeContext, notificationCreator]);
  
  // Respond to an invitation (for invited users) - FIXED to avoid duplicate notifications
  const handleRespondToInvitation = useCallback(async (
    teeTimeId: string, 
    playerId: string, 
    response: 'accept' | 'decline'
  ): Promise<boolean> => {
    if (!user) {
      throw new Error('You must be logged in to respond to invitations');
    }
    
    // Set responding state
    const operationKey = `respond_${teeTimeId}_${response}`;
    setIsResponding(prev => ({ ...prev, [operationKey]: true }));
    
    try {
      // Use context function to update status which will handle the notifications
      const success = await teeTimeContext.respondToInvitation(teeTimeId, playerId, response);
      return success;
    } catch (error) {
      console.error(`Error ${response}ing invitation:`, error);
      
      // The context already showed a toast, so we don't need to show another one
      throw error;
    } finally {
      // Clear responding state
      setIsResponding(prev => ({ ...prev, [operationKey]: false }));
    }
  }, [user, teeTimeContext]);
  
  // Handle delete post operation (not exposed in context)
  const deletePost = useCallback(async (
    postId: string, 
    options?: { 
      skipConfirmation?: boolean; 
      showSuccess?: boolean;
      reason?: string;
      refreshFeed?: boolean;
    }
  ): Promise<boolean> => {
    if (!user) return false;
    
    // Mark as deleting
    setIsDeleting(prev => ({ ...prev, [postId]: true }));
    
    try {
      // Call the API to delete the post
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: options?.reason || 'user_requested',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete post');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    } finally {
      // Clear deleting state
      setIsDeleting(prev => ({ ...prev, [postId]: false }));
    }
  }, [user]);
  
  // Handle delete tee time
  const handleDeleteTeeTime = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      throw new Error('You must be logged in to delete a tee time');
    }
    
    try {
      // Use the context method to delete the tee time
      return await teeTimeContext.deleteTeeTime(teeTimeId);
    } catch (error) {
      console.error('Error deleting tee time:', error);
      throw error;
    }
  }, [user, teeTimeContext]);
  
  // Get user tee times - FIXED to properly handle pagination
  const getUserTeeTimes = useCallback(async (
    options?: {
      status?: string;
      lastVisible?: DocumentSnapshot;
      pageSize?: number;
    }
  ): Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }> => {
    if (!user) {
      throw new Error('You must be logged in to view your tee times');
    }
    
    try {
      // Use the context method which returns paginated results
      return await teeTimeContext.getUserTeeTimes(
        options?.status,
        options?.lastVisible,
        options?.pageSize
      );
    } catch (error) {
      console.error('Error getting user tee times:', error);
      throw error;
    }
  }, [user, teeTimeContext]);
  
  // NEW: Subscribe to a user's tee times with real-time updates
  const subscribeTeeTimesByUser = useCallback((
    callback: (teeTimes: TeeTime[]) => void
  ): (() => void) => {
    if (!user) {
      console.warn('Cannot subscribe to tee times: user not logged in');
      callback([]);
      return () => {}; // Return empty unsubscribe function
    }
    
    // Use the context's subscription function with the current user
    return teeTimeContext.subscribeTeeTimesByUser(user.uid, callback);
  }, [user, teeTimeContext]);
  
  // Return all context functions plus the additional ones
  return {
    // Pass through all context properties
    ...teeTimeContext,
    
    // Override loading state to include additional states
    isLoading,
    
    // Add custom functions
    createTeeTime: handleCreateTeeTime,
    joinTeeTime: handleJoinRequest,
    respondToInvitation: handleRespondToInvitation,
    deleteTeeTime: handleDeleteTeeTime,
    deletePost,
    getUserTeeTimes, // FIXED version that returns paginated results
    subscribeTeeTimesByUser, // NEW: Add real-time subscription function
    
    // Add internal states for UI
    isDeleting,
    isResponding
  };
}
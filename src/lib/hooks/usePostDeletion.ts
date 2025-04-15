// src/lib/hooks/usePostDeletion.ts
import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { deletePost, softDeletePost, refreshFeedAfterDeletion } from '@/lib/firebase/feed-delete-service';

interface DeletePostOptions {
  skipConfirmation?: boolean;
  showSuccess?: boolean;
  reason?: 'user_requested' | 'moderation' | 'privacy_violation' | 'content_policy';
  softDelete?: boolean;
  refreshFeed?: boolean;
  onSuccess?: () => void;
}

/**
 * Custom hook for post deletion with optimistic UI updates
 * Integrates with the server-side deletion system
 */
export function usePostDeletion() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [failedDeletions, setFailedDeletions] = useState<string[]>([]);

  /**
   * Delete a post with optimistic UI updates
   */
  const handleDeletePost = useCallback(async (
    postId: string,
    options: DeletePostOptions = {}
  ) => {
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'You must be logged in to delete posts'
      });
      return false;
    }

    // Skip if already deleting
    if (isDeleting[postId]) {
      return false;
    }

    try {
      // Show confirmation if needed
      if (!options.skipConfirmation) {
        const confirmed = window.confirm(
          'Are you sure you want to delete this post? This action cannot be undone.'
        );
        
        if (!confirmed) {
          return false;
        }
      }

      // Mark as deleting for optimistic UI
      setIsDeleting(prev => ({ ...prev, [postId]: true }));

      // Remove from failed deletions if it was there
      if (failedDeletions.includes(postId)) {
        setFailedDeletions(prev => prev.filter(id => id !== postId));
      }

      // Perform the actual deletion
      const deletionSuccess = options.softDelete
        ? await softDeletePost(postId, user.uid, options.reason)
        : await deletePost(postId, user.uid, {
            reason: options.reason || 'user_requested'
          });

      // If the deletion was successful
      if (deletionSuccess) {
        // Show success notification if requested
        if (options.showSuccess) {
          showNotification({
            type: 'success',
            title: 'Success',
            description: options.softDelete
              ? 'Post has been hidden'
              : 'Post has been deleted'
          });
        }

        // Refresh feed if requested
        if (options.refreshFeed && user) {
          await refreshFeedAfterDeletion(user.uid);
        }

        // Call success callback if provided
        if (options.onSuccess) {
          options.onSuccess();
        }
      }

      return deletionSuccess;
    } catch (error) {
      console.error(`Error deleting post ${postId}:`, error);
      
      // Add to failed deletions
      setFailedDeletions(prev => [...prev, postId]);
      
      // Show error notification
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to delete post. Please try again later.'
      });
      
      return false;
    } finally {
      // Clear the deleting state
      setIsDeleting(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
    }
  }, [user, showNotification, isDeleting, failedDeletions]);

  /**
   * Retry a failed deletion
   */
  const retryFailedDeletion = useCallback(async (
    postId: string,
    options: DeletePostOptions = {}
  ) => {
    if (!failedDeletions.includes(postId)) {
      return false;
    }

    return await handleDeletePost(postId, {
      skipConfirmation: true, // Skip confirmation on retry
      ...options
    });
  }, [failedDeletions, handleDeletePost]);

  /**
   * Clear a post from failed deletions list
   * (Useful if user decides to keep the post)
   */
  const clearFailedDeletion = useCallback((postId: string) => {
    setFailedDeletions(prev => prev.filter(id => id !== postId));
  }, []);

  return {
    deletePost: handleDeletePost,
    softDeletePost: (postId: string, options: DeletePostOptions = {}) => 
      handleDeletePost(postId, { ...options, softDelete: true }),
    retryFailedDeletion,
    clearFailedDeletion,
    isDeleting,
    failedDeletions,
    hasFailedDeletions: failedDeletions.length > 0
  };
}
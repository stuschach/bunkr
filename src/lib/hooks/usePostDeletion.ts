// src/lib/hooks/usePostDeletion.ts
import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext'; // Fixed: Changed from useNotification to useNotifications
import { deletePost, refreshFeedAfterDeletion } from '@/lib/firebase/feed-delete-service';

interface DeletePostOptions {
  skipConfirmation?: boolean;
  showSuccess?: boolean;
  reason?: 'user_requested' | 'moderation' | 'privacy_violation' | 'content_policy';
  isSilent?: boolean;
  refreshFeed?: boolean;
}

export function usePostDeletion() {
  const { user } = useAuth();
  const { showNotification } = useNotifications(); // Fixed: Changed from useNotification to useNotifications
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [failedDeletions, setFailedDeletions] = useState<string[]>([]);

  const deletePostWithConfirmation = useCallback(async (
    postId: string,
    options: DeletePostOptions = {}
  ): Promise<boolean> => {
    if (!user) return false;

    // Skip if already in progress
    if (isDeleting[postId]) return false;

    try {
      // Show confirmation dialog unless skipped
      if (!options.skipConfirmation) {
        const confirmed = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
        if (!confirmed) return false;
      }

      // Mark as deleting
      setIsDeleting(prev => ({ ...prev, [postId]: true }));

      // Perform deletion
      const success = await deletePost(
        postId, 
        user.uid, 
        {
          reason: options.reason || 'user_requested',
          isSilent: options.isSilent || false
        }
      );

      // Show success notification if requested
      if (success && options.showSuccess) {
        showNotification({
          type: 'success',
          title: 'Post deleted',
          description: 'Your post has been successfully deleted'
        });
      }

      // Refresh feed if requested
      if (options.refreshFeed) {
        await refreshFeedAfterDeletion(user.uid);
      }

      // Clear deletion status
      setIsDeleting(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });

      return success;
    } catch (error) {
      console.error(`Error deleting post ${postId}:`, error);
      
      // Show error notification
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to delete post. Please try again.'
      });
      
      // Track failed deletion
      setFailedDeletions(prev => [...prev, postId]);
      
      // Clear deletion status
      setIsDeleting(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      
      return false;
    }
  }, [user, isDeleting, showNotification]);

  return {
    deletePost: deletePostWithConfirmation,
    isDeleting,
    failedDeletions,
    clearFailedDeletions: () => setFailedDeletions([])
  };
}
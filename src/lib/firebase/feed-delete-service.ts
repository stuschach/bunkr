// src/lib/firebase/feed-delete-service.ts
import { 
    collection,
    doc,
    getDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    query,
    where,
    limit,
    orderBy,
    serverTimestamp,
    addDoc,
    Timestamp,
    updateDoc,
  } from 'firebase/firestore';
  import { db, functions } from '@/lib/firebase/config';
  import { httpsCallable } from 'firebase/functions';
  import { cacheService } from '@/lib/services/CacheService';
  import { getFeedForUser } from '@/lib/firebase/feed-service';
  
  // Reference to Cloud Function - we keep this but won't call it directly now
  const deletePostReferences = httpsCallable(functions, 'deletePostReferences');
  
  /**
   * Complete post deletion with all associated data
   * @param postId The ID of the post to delete
   * @param authorId The author of the post
   * @param options Additional options for deletion
   * @returns Promise that resolves when deletion is complete
   */
  export async function deletePost(
    postId: string, 
    authorId: string,
    options: {
      reason?: 'user_requested' | 'moderation' | 'privacy_violation' | 'content_policy';
      isSilent?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      console.log(`Starting deletion of post ${postId} by user ${authorId}`);
      
      // Verify the post exists and the user is authorized to delete it
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.warn(`Post ${postId} not found, already deleted`);
        return true; // Consider it a success if already deleted
      }
      
      const postData = postSnap.data();
      
      // Security check: Ensure the user is authorized to delete this post
      if (postData.authorId !== authorId) {
        console.error(`User ${authorId} not authorized to delete post ${postId}`);
        throw new Error('Not authorized to delete this post');
      }
      
      // Create a deletion record for audit purposes
      if (!options.isSilent) {
        await addDoc(collection(db, 'deletedContent'), {
          contentId: postId,
          contentType: 'post',
          authorId,
          deletedAt: serverTimestamp(),
          originalContent: {
            content: postData.content,
            postType: postData.postType,
            createdAt: postData.createdAt,
            media: postData.media || [],
            visibility: postData.visibility,
            hashtags: postData.hashtags || [],
          },
          reason: options.reason || 'user_requested'
        });
      }

      // STEP 1: Mark post as deleted but don't delete it yet
      await updateDoc(postRef, { 
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
      
      // STEP 2: Clean client-side cache
      cleanupPostCache(postId);
      
      // STEP 3: Delete the post document - this will trigger the Cloud Function
      await deleteDoc(postRef);
      
      console.log(`Successfully deleted post ${postId}`);
      return true;
      
    } catch (error) {
      console.error(`Error deleting post ${postId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clean up client-side cache for a deleted post
   */
  function cleanupPostCache(postId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Remove post from cache
      cacheService.remove(`post-${postId}`);
      
      // We don't have direct access to feed caches for all users,
      // but we can clear the current user's feed cache to ensure
      // deleted posts don't appear
      const clearFeedCacheTypes = ['all', 'posts', 'rounds', 'tee-times'];
      
      clearFeedCacheTypes.forEach(type => {
        // Clear the first page of each feed type
        if (window.userId) { // Make sure userId is available
          cacheService.remove(`feed-${window.userId}-${type}-0`);
        }
      });
      
    } catch (error) {
      console.warn('Error cleaning up post cache:', error);
      // Non-critical error, continue
    }
  }
  
  /**
   * Check if a post exists and is accessible
   * @param postId The post ID to check
   * @returns Whether the post exists and is accessible
   */
  export async function checkPostExists(postId: string): Promise<boolean> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      return postSnap.exists() && !postSnap.data()?.isDeleted;
    } catch (error) {
      console.error(`Error checking if post ${postId} exists:`, error);
      return false;
    }
  }
  
  /**
   * Mark a post as deleted without actually deleting it
   * Useful for moderation or legal compliance
   */
  export async function softDeletePost(
    postId: string, 
    authorId: string,
    reason: string = 'moderation'
  ): Promise<boolean> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        return false;
      }
      
      // Verify ownership or admin status
      const postData = postSnap.data();
      if (postData.authorId !== authorId && !isAdminUser(authorId)) {
        throw new Error('Not authorized to soft-delete this post');
      }
      
      // Update the post to mark as deleted but preserve content
      await updateDoc(postRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        moderationReason: reason,
        visibleToOwner: true // Can still be seen by original author
      });
      
      // Make record of deletion
      await addDoc(collection(db, 'moderationActions'), {
        contentId: postId,
        contentType: 'post',
        action: 'soft_delete',
        moderatorId: authorId,
        timestamp: serverTimestamp(),
        reason
      });
      
      // Clean client-side cache
      cleanupPostCache(postId);
      
      return true;
    } catch (error) {
      console.error(`Error soft-deleting post ${postId}:`, error);
      throw error;
    }
  }
  
  // Helper function to check if a user is an admin
  // This would be implemented according to your app's permissions model
  function isAdminUser(userId: string): boolean {
    // This would check against your admin users list
    // For now, return false as a placeholder
    return false;
  }
  
  // Optional: Export a method to force refresh feeds after deletion
  export async function refreshFeedAfterDeletion(userId: string): Promise<void> {
    try {
      // Clear cache for all feed types
      const clearFeedCacheTypes = ['all', 'posts', 'rounds', 'tee-times'];
      
      clearFeedCacheTypes.forEach(type => {
        cacheService.remove(`feed-${userId}-${type}-0`);
      });
      
      // Force fetch fresh feed data to update client state
      await getFeedForUser(userId, 'all', null, 5);
      
    } catch (error) {
      console.error('Error refreshing feed after deletion:', error);
    }
  }
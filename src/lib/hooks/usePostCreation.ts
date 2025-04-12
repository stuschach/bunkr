// src/lib/hooks/usePostCreation.ts
import { useState, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { fanoutPostToFeeds } from '@/lib/firebase/feed-service';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { DenormalizedAuthorData } from '@/types/post';

/**
 * Hook for unified post creation across different post types
 * This consolidates the creation logic to ensure all posts are properly:
 * 1. Created in the posts collection
 * 2. Fanned out to followers' feeds
 */
export function usePostCreation() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [isCreating, setIsCreating] = useState(false);
  
  /**
   * Create a post of any type and fan it out to followers' feeds
   * @param postData - Content and metadata for the post
   * @param postType - Type of post (regular, tee-time, round)
   */
  const createPost = useCallback(async (
    postData: Record<string, any>, 
    postType: 'regular' | 'tee-time' | 'round' = 'regular'
  ) => {
    if (!user) {
      showNotification?.({
        type: 'error',
        title: 'Error',
        description: 'You must be logged in to create a post'
      });
      return null;
    }
    
    setIsCreating(true);
    
    try {
      // Create the author data for fanout
      const authorData: DenormalizedAuthorData = {
        uid: user.uid,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        handicapIndex: user.handicapIndex
      };
      
      // Basic post fields
      const basePostData = {
        authorId: user.uid,
        postType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likes: 0,
        comments: 0,
        likedBy: [],
        hashtags: [],
        ...postData
      };
      
      // Create post document
      const postRef = await addDoc(collection(db, 'posts'), basePostData);
      
      // Update the post with its ID - FIXED: using updateDoc instead of addDoc
      await updateDoc(doc(db, 'posts', postRef.id), {
        id: postRef.id
      });
      
      // Fan out the post to followers' feeds
      await fanoutPostToFeeds(postRef.id, user.uid, authorData, postType);
      
      showNotification?.({
        type: 'success',
        title: 'Success',
        description: 'Your post has been published'
      });
      
      return postRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      showNotification?.({
        type: 'error',
        title: 'Error',
        description: 'Failed to create post. Please try again.'
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [user, showNotification]);
  
  return {
    createPost,
    isCreating
  };
}
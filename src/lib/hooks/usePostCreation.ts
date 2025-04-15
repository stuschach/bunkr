// src/lib/hooks/usePostCreation.ts
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { fanoutPostToFeeds } from '@/lib/firebase/feed-service';
import { useNotification } from '@/lib/contexts/NotificationContext';

export function usePostCreation() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const { showNotification } = useNotification();

  const createPost = async (postData, postType = 'regular') => {
    if (!user) {
      throw new Error('User must be authenticated to create a post');
    }

    setIsCreating(true);

    try {
      // Create the denormalized author data with complete profile information
      const authorData = {
        uid: user.uid,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || null,
        handicapIndex: user.handicapIndex || null
      };

      // Create the post document with complete author data
      const postRef = await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        author: authorData, // Include complete author data
        content: postData.content || '',
        media: postData.media || [],
        createdAt: serverTimestamp(),
        postType,
        visibility: postData.visibility || 'public',
        likes: 0,
        comments: 0,
        likedBy: [],
        hashtags: postData.hashtags || [],
        location: postData.location || null,
        ...(postData.roundId && { roundId: postData.roundId }),
        ...(postData.teeTimeId && { teeTimeId: postData.teeTimeId }),
        ...(postData.courseName && { courseName: postData.courseName }),
        ...(postData.dateTime && { dateTime: postData.dateTime }),
        ...(postData.maxPlayers && { maxPlayers: postData.maxPlayers })
      });

      console.log('Post created with author data:', authorData);

      // Fan out the post to followers' feeds with the complete author data
      await fanoutPostToFeeds(postRef.id, user.uid, authorData, postType);

      // Show success notification
      showNotification({
        type: 'success',
        title: 'Post created',
        description: 'Your post has been published successfully'
      });

      setIsCreating(false);
      return postRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      
      // Show error notification
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to create post. Please try again.'
      });
      
      setIsCreating(false);
      throw error;
    }
  };

  return { createPost, isCreating };
}
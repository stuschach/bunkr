// src/lib/hooks/useNotificationCreator.ts
// Enhanced to provide more tailored notification messages

import { useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// A hook to easily create notifications from any component
export function useNotificationCreator() {
  const { user } = useAuth();

  // Create a notification with atomic updates
  const sendNotification = useCallback(async (
    recipientId: string,
    type: string,
    entityId: string,
    entityType: 'post' | 'tee-time' | 'profile' | 'round' | 'comment' | 'message' | 'tournament' | 'course',
    data?: any,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      // Skip if sending to self (except for system notifications)
      if (recipientId === user.uid && type !== 'handicap-updated' && 
          type !== 'tournament-update') return null;

      console.log(`Creating notification of type ${type} for user ${recipientId}`);
      
      // Create a batch to ensure atomic updates
      const batch = writeBatch(db);
      
      // Create a new notification document reference
      const notificationsCollection = collection(db, 'notifications');
      const notificationRef = doc(notificationsCollection);
      
      // Check if data exists, if not create an empty object
      const safeData = data || {};
      
      // Add notification to batch
      batch.set(notificationRef, {
        userId: recipientId,
        type,
        entityId,
        entityType,
        actorId: user.uid,
        isRead: false,
        createdAt: serverTimestamp(),
        data: safeData,
        priority
      });
      
      // Update unread notifications count in user document
      const userRef = doc(db, 'users', recipientId);
      batch.update(userRef, {
        unreadNotifications: increment(1)
      });
      
      // Commit all changes atomically
      await batch.commit();
      
      console.log(`Notification created with ID: ${notificationRef.id}`);
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      // Try the fallback approach if batch update fails (might be missing user document)
      try {
        console.log('Batch update failed, trying direct notification creation');
        
        // Ensure we have a valid data object to prevent undefined fields
        const safeData = data || {};
        
        const notificationData = {
          userId: recipientId,
          type,
          entityId,
          entityType,
          actorId: user.uid,
          isRead: false,
          createdAt: serverTimestamp(),
          data: safeData,
          priority
        };
        
        const docRef = await addDoc(collection(db, 'notifications'), notificationData);
        console.log(`Notification created with fallback method, ID: ${docRef.id}`);
        return docRef.id;
      } catch (fallbackError) {
        console.error('Fallback notification creation also failed:', fallbackError);
        return null;
      }
    }
  }, [user]);

  // Specialized notification creators for common scenarios
  const notifyLike = useCallback(async (
    postId: string, 
    authorId: string, 
    postContent?: string
  ) => {
    // Extract post type hint if available (added to postContent by the caller)
    let postTypeHint = "post";
    
    // Check if postContent contains a post type hint
    if (postContent?.includes("Round at")) {
      postTypeHint = "round";
    } else if (postContent?.includes("Tee time at")) {
      postTypeHint = "tee time";
    } else if (postContent?.toLowerCase().includes("photo")) {
      postTypeHint = "photo";
    } else if (postContent?.toLowerCase().includes("video")) {
      postTypeHint = "video";
    }
    
    // Create safe content that won't be undefined
    const safeContent = postContent || "";
    
    return sendNotification(
      authorId,
      'like',
      postId,
      'post',
      {
        content: safeContent.substring(0, 100) + (safeContent.length > 100 ? '...' : ''),
        postType: postTypeHint // Include post type hint for notification rendering
      }
    );
  }, [sendNotification]);

  const notifyComment = useCallback(async (
    postId: string,
    authorId: string,
    commentText: string,
    postContent?: string
  ) => {
    // Extract post type hint if available (added to postContent by the caller)
    let postTypeHint = "post";
    
    // Check if postContent contains a post type hint
    if (postContent?.includes("Round at")) {
      postTypeHint = "round";
    } else if (postContent?.includes("Tee time at")) {
      postTypeHint = "tee time";
    } else if (postContent?.toLowerCase().includes("photo")) {
      postTypeHint = "photo";
    } else if (postContent?.toLowerCase().includes("video")) {
      postTypeHint = "video";
    }
    
    // Create safe content that won't be undefined
    const safePostContent = postContent || "";
    const safeCommentText = commentText || "";
    
    return sendNotification(
      authorId,
      'comment',
      postId,
      'post',
      {
        content: safeCommentText.substring(0, 100) + (safeCommentText.length > 100 ? '...' : ''),
        postContent: safePostContent.substring(0, 100) + (safePostContent.length > 100 ? '...' : ''),
        postType: postTypeHint // Include post type hint for notification rendering
      }
    );
  }, [sendNotification]);

  const notifyFollow = useCallback(async (
    userId: string
  ) => {
    console.log(`Creating follow notification for user: ${userId}`);
    return sendNotification(
      userId,
      'follow',
      userId,
      'profile'
    );
  }, [sendNotification]);

  const notifyTeeTimeInvite = useCallback(async (
    userId: string,
    teeTimeId: string,
    courseName: string,
    date: Date | string
  ) => {
    return sendNotification(
      userId,
      'tee-time-invite',
      teeTimeId,
      'tee-time',
      {
        courseName,
        date: date instanceof Date ? date.toISOString() : date
      }
    );
  }, [sendNotification]);

  const notifyTeeTimeApproved = useCallback(async (
    userId: string,
    teeTimeId: string,
    courseName: string,
    date: Date | string
  ) => {
    return sendNotification(
      userId,
      'tee-time-approved',
      teeTimeId,
      'tee-time',
      {
        courseName,
        date: date instanceof Date ? date.toISOString() : date
      }
    );
  }, [sendNotification]);

  const notifyTeeTimeRequest = useCallback(async (
    hostId: string,
    teeTimeId: string,
    courseName: string,
    date: Date | string
  ) => {
    return sendNotification(
      hostId,
      'tee-time-request',
      teeTimeId,
      'tee-time',
      {
        courseName,
        date: date instanceof Date ? date.toISOString() : date
      },
      'high' // Priority for tee time requests
    );
  }, [sendNotification]);

  const notifyRoundShared = useCallback(async (
    recipientId: string,
    roundId: string,
    courseName: string,
    score: number
  ) => {
    return sendNotification(
      recipientId,
      'round-shared',
      roundId,
      'round',
      {
        courseName,
        score
      }
    );
  }, [sendNotification]);

  const notifyMention = useCallback(async (
    userId: string,
    entityId: string,
    entityType: 'post' | 'comment',
    content: string
  ) => {
    return sendNotification(
      userId,
      'mention',
      entityId,
      entityType,
      {
        content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      }
    );
  }, [sendNotification]);

  return {
    sendNotification,
    notifyLike,
    notifyComment,
    notifyFollow,
    notifyTeeTimeInvite,
    notifyTeeTimeApproved,
    notifyTeeTimeRequest,
    notifyRoundShared,
    notifyMention
  };
}
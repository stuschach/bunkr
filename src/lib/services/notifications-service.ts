// src/lib/services/notifications-service.ts
import { 
    collection, 
    doc,
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    Timestamp,
    serverTimestamp,
    onSnapshot,
    deleteDoc,
    writeBatch,
    increment,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase/config';
  import { UserProfile } from '@/types/auth';
  import { Notification, NotificationType, NotificationPreferences } from '@/types/notification';
  
  // Create a new notification
  export const createNotification = async (
    userId: string,
    type: NotificationType,
    entityId: string,
    entityType: 'post' | 'tee-time' | 'profile' | 'round' | 'comment' | 'message' | 'tournament' | 'course',
    actorId: string,
    data?: any,
    priority: 'normal' | 'high' = 'normal'
  ): Promise<string> => {
    try {
      // Check if a similar notification already exists to prevent duplicates
      // For example, don't send multiple like notifications from the same user on the same post
      if (type === 'like' || type === 'follow') {
        const existingQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('type', '==', type),
          where('entityId', '==', entityId),
          where('actorId', '==', actorId)
        );
        
        const existingDocs = await getDocs(existingQuery);
        
        if (!existingDocs.empty) {
          // Update the existing notification instead of creating a new one
          const existingDoc = existingDocs.docs[0];
          await updateDoc(doc(db, 'notifications', existingDoc.id), {
            isRead: false, // Reset read status
            createdAt: serverTimestamp(), // Update timestamp
            data: data || {}, // Update data if provided
            priority // Update priority
          });
          
          return existingDoc.id;
        }
      }
      
      // Create a new notification
      const notificationRef = doc(collection(db, 'notifications'));
      
      await setDoc(notificationRef, {
        userId,
        type,
        entityId,
        entityType,
        actorId,
        isRead: false,
        createdAt: serverTimestamp(),
        data: data || {},
        priority
      });
      
      // Update unread count in user document
      await updateDoc(doc(db, 'users', userId), {
        unreadNotifications: increment(1)
      });
      
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  };
  
  // Get notifications for a user with pagination
  export const getUserNotifications = async (
    userId: string,
    pageSize: number = 20,
    onlyUnread: boolean = false,
    lastVisible?: QueryDocumentSnapshot<DocumentData>
  ): Promise<Notification[]> => {
    try {
      let notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      if (onlyUnread) {
        notificationsQuery = query(
          notificationsQuery,
          where('isRead', '==', false)
        );
      }
      
      // Apply pagination
      if (lastVisible) {
        notificationsQuery = query(
          notificationsQuery,
          startAfter(lastVisible),
          limit(pageSize)
        );
      } else {
        notificationsQuery = query(
          notificationsQuery,
          limit(pageSize)
        );
      }
      
      const querySnapshot = await getDocs(notificationsQuery);
      const notifications: Notification[] = [];
      
      // Process notifications and populate actor data
      for (const docSnapshot of querySnapshot.docs) {
        const notificationData = docSnapshot.data();
        
        // Fetch actor data
        let actor: UserProfile | undefined = undefined;
        
        if (notificationData.actorId) {
          const actorDoc = await getDoc(doc(db, 'users', notificationData.actorId));
          if (actorDoc.exists()) {
            actor = {
              uid: actorDoc.id,
              ...actorDoc.data()
            } as UserProfile;
          }
        }
        
        notifications.push({
          id: docSnapshot.id,
          userId: notificationData.userId,
          type: notificationData.type,
          entityId: notificationData.entityId,
          entityType: notificationData.entityType,
          actorId: notificationData.actorId,
          actor,
          isRead: notificationData.isRead,
          createdAt: notificationData.createdAt instanceof Timestamp 
            ? notificationData.createdAt.toDate() 
            : notificationData.createdAt,
          data: notificationData.data,
          priority: notificationData.priority || 'normal'
        });
      }
      
      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  };
  
  // Subscribe to real-time notifications
  export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void,
    limit_: number = 50
  ): (() => void) => {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limit_)
    );
    
    // Create real-time listener
    const unsubscribe = onSnapshot(notificationsQuery, async (snapshot) => {
      const notifications: Notification[] = [];
      const actorPromises: Promise<void>[] = [];
      const actorsMap: Record<string, UserProfile> = {};
      
      // First, collect unique actor IDs
      const actorIds = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.actorId) {
          actorIds.add(data.actorId);
        }
      });
      
      // Fetch all actors in parallel
      for (const actorId of actorIds) {
        const promise = getDoc(doc(db, 'users', actorId)).then(actorDoc => {
          if (actorDoc.exists()) {
            actorsMap[actorId] = {
              uid: actorDoc.id,
              ...actorDoc.data()
            } as UserProfile;
          }
        }).catch(error => {
          console.error('Error fetching actor:', error);
        });
        
        actorPromises.push(promise);
      }
      
      // Wait for all actor fetches to complete
      await Promise.all(actorPromises);
      
      // Now process all notifications with the pre-fetched actors
      for (const docSnapshot of snapshot.docs) {
        const notificationData = docSnapshot.data();
        
        notifications.push({
          id: docSnapshot.id,
          userId: notificationData.userId,
          type: notificationData.type,
          entityId: notificationData.entityId,
          entityType: notificationData.entityType,
          actorId: notificationData.actorId,
          actor: notificationData.actorId ? actorsMap[notificationData.actorId] : undefined,
          isRead: notificationData.isRead,
          createdAt: notificationData.createdAt instanceof Timestamp 
            ? notificationData.createdAt.toDate() 
            : notificationData.createdAt,
          data: notificationData.data,
          priority: notificationData.priority || 'normal'
        });
      }
      
      callback(notifications);
    }, (error) => {
      console.error('Error in notifications subscription:', error);
    });
    
    return unsubscribe;
  };
  
  // Mark a notification as read
  export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      const notificationDoc = await getDoc(notificationRef);
      
      if (notificationDoc.exists() && !notificationDoc.data().isRead) {
        // Update the notification
        await updateDoc(notificationRef, {
          isRead: true
        });
        
        // Update the user's unread count
        const userId = notificationDoc.data().userId;
        await updateDoc(doc(db, 'users', userId), {
          unreadNotifications: increment(-1)
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  };
  
  // Mark all notifications as read
  export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    try {
      const batch = writeBatch(db);
      
      // Get all unread notifications
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const unreadDocs = await getDocs(unreadQuery);
      
      // Nothing to update
      if (unreadDocs.empty) {
        return;
      }
      
      // Add all updates to batch
      unreadDocs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, { isRead: true });
      });
      
      // Update user's unread count
      batch.update(doc(db, 'users', userId), {
        unreadNotifications: 0
      });
      
      // Commit the batch
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  };
  
  // Delete a notification
  export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      const notificationDoc = await getDoc(notificationRef);
      
      if (notificationDoc.exists()) {
        // Check if notification is unread
        if (!notificationDoc.data().isRead) {
          // Decrement unread count
          const userId = notificationDoc.data().userId;
          await updateDoc(doc(db, 'users', userId), {
            unreadNotifications: increment(-1)
          });
        }
        
        // Delete the notification
        await deleteDoc(notificationRef);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  };
  
  // Get unread notification count
  export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
    try {
      // Try to get count from user document first (more efficient)
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists() && typeof userDoc.data().unreadNotifications === 'number') {
        return userDoc.data().unreadNotifications;
      }
      
      // Fall back to counting unread notifications
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(unreadQuery);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw error;
    }
  };
  
  // Save notification preferences
  export const saveNotificationPreferences = async (
    userId: string, 
    preferences: NotificationPreferences
  ): Promise<void> => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        notificationPreferences: preferences
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      throw error;
    }
  };
  
  // Get notification preferences
  export const getNotificationPreferences = async (
    userId: string
  ): Promise<NotificationPreferences | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists() && userDoc.data().notificationPreferences) {
        return userDoc.data().notificationPreferences as NotificationPreferences;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      throw error;
    }
  };
  
  // Clear all notifications for a user
  export const clearAllNotifications = async (userId: string): Promise<void> => {
    try {
      const batch = writeBatch(db);
      
      // Get all notifications for the user
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(500) // Firestore has a limit of 500 operations per batch
      );
      
      const querySnapshot = await getDocs(notificationsQuery);
      
      if (querySnapshot.empty) {
        return;
      }
      
      // Add all deletes to batch
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      
      // Reset unread count
      batch.update(doc(db, 'users', userId), {
        unreadNotifications: 0
      });
      
      // Commit the batch
      await batch.commit();
      
      // If there are more than 500 notifications, recursively delete the rest
      if (querySnapshot.size === 500) {
        await clearAllNotifications(userId);
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  };
  
  // Create golf-specific notifications
  
  // Handicap Updated Notification
  export const createHandicapUpdatedNotification = async (
    userId: string,
    newHandicap: number,
    previousHandicap: number
  ): Promise<string> => {
    return createNotification(
      userId,
      'handicap-updated',
      userId, // entityId is the user
      'profile', // entityType
      'system', // actorId for system-generated notifications
      {
        newHandicap,
        previousHandicap,
        content: `Your handicap has been updated from ${previousHandicap} to ${newHandicap}`
      },
      'high' // Priority
    );
  };
  
  // Tournament Update Notification
  export const createTournamentUpdateNotification = async (
    userId: string,
    tournamentId: string,
    tournamentName: string,
    updateType: 'registration' | 'pairing' | 'leaderboard' | 'results',
    tournamentRound?: number,
    data?: any
  ): Promise<string> => {
    let content = '';
    
    switch (updateType) {
      case 'registration':
        content = `Registration confirmed for ${tournamentName}`;
        break;
      case 'pairing':
        content = `Your pairing is available for ${tournamentName}${tournamentRound ? ` round ${tournamentRound}` : ''}`;
        break;
      case 'leaderboard':
        content = `Leaderboard update for ${tournamentName}`;
        break;
      case 'results':
        content = `Final results are available for ${tournamentName}`;
        break;
    }
    
    return createNotification(
      userId,
      'tournament-update',
      tournamentId,
      'tournament',
      'system',
      {
        tournamentName,
        tournamentRound,
        updateType,
        content,
        ...data
      }
    );
  };
  
  // Course Review Notification
  export const createCourseReviewNotification = async (
    userId: string,
    courseId: string,
    courseName: string,
    reviewId: string,
    reviewerName: string,
    reviewerId: string,
    rating: number
  ): Promise<string> => {
    return createNotification(
      userId,
      'course-review',
      courseId,
      'course',
      reviewerId,
      {
        courseName,
        reviewId,
        courseRating: rating,
        content: `${reviewerName} left a ${rating}-star review on ${courseName}`
      }
    );
  };
  
  // Friend Activity Notification
  export const createFriendActivityNotification = async (
    userId: string,
    friendId: string,
    activityType: 'round' | 'achievement' | 'milestone',
    data: any
  ): Promise<string> => {
    return createNotification(
      userId,
      'friend-activity',
      friendId,
      'profile',
      friendId,
      {
        activityType,
        ...data
      },
      'normal'
    );
  };
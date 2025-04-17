// src/tee-time.functions.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { PubSub } from '@google-cloud/pubsub';

// Constants for batch operations
const MAX_BATCH_SIZE = 500;
const NOTIFICATION_BATCH_SIZE = 250;

// Constants for cleanup tasks
const CLEANUP_TASK_TOPIC = 'scheduled-tee-time-cleanup';
const CLEANUP_DAYS_THRESHOLD = 30;

/**
 * When a new tee time is created, create a corresponding post
 * and notify followers based on visibility settings
 */
export const onTeeTimeCreated = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('teeTimes/{teeTimeId}')
  .onCreate(async (snapshot, context) => {
    const teeTimeId = context.params.teeTimeId;
    const teeTimeData = snapshot.data();
    
    if (!teeTimeData) {
      logger.error(`Missing data for tee time ${teeTimeId}`);
      return false;
    }
    
    try {
      logger.info(`Processing new tee time creation: ${teeTimeId}`);
      
      // Skip if this is a system-created tee time without creator
      if (!teeTimeData.creatorId) {
        logger.warn(`Tee time ${teeTimeId} has no creator ID, skipping post creation`);
        return true;
      }
      
      // Format date for post content
      const dateTime = teeTimeData.dateTime instanceof admin.firestore.Timestamp 
        ? teeTimeData.dateTime.toDate() 
        : new Date(teeTimeData.dateTime || Date.now());
      
      // Create a post for this tee time
      const postRef = admin.firestore().collection('posts').doc();
      
      const postData = {
        authorId: teeTimeData.creatorId,
        content: `I'm hosting a tee time at ${teeTimeData.courseName || 'my local course'} on ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Looking for ${(teeTimeData.maxPlayers || 4) - 1} more players!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        postType: 'tee-time',
        teeTimeId: teeTimeId,
        courseName: teeTimeData.courseName || '',
        courseId: teeTimeData.courseId || null,
        dateTime: teeTimeData.dateTime || admin.firestore.Timestamp.fromDate(new Date()),
        maxPlayers: teeTimeData.maxPlayers || 4,
        visibility: teeTimeData.visibility === 'private' ? 'private' : 'public',
        likeCount: 0,
        commentCount: 0
      };
      
      await postRef.set(postData);
      logger.info(`Created post ${postRef.id} for tee time ${teeTimeId}`);
      
      // If tee time is visible to followers, notify them
      if (teeTimeData.visibility === 'followers') {
        await notifyFollowers(teeTimeData.creatorId, teeTimeId, teeTimeData);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error processing new tee time ${teeTimeId}:`, error);
      return false;
    }
  });

/**
 * Helper function to notify followers with pagination
 */
async function notifyFollowers(creatorId: string, teeTimeId: string, teeTimeData: any) {
  let lastDocumentRef = null;
  let hasMoreFollowers = true;
  let totalNotificationsSent = 0;
  
  // Get creator's display name for notifications
  const creatorDoc = await admin.firestore()
    .collection('users')
    .doc(creatorId)
    .get();
  
  const creatorName = creatorDoc.exists 
    ? creatorDoc.data()?.displayName || 'Someone' 
    : 'Someone';
    
  const dateTime = teeTimeData.dateTime instanceof admin.firestore.Timestamp 
    ? teeTimeData.dateTime.toDate() 
    : new Date(teeTimeData.dateTime || Date.now());
    
  // Process followers in batches with pagination
  while (hasMoreFollowers) {
    try {
      // Build query with pagination
      let followersQuery = admin.firestore()
        .collection('followers')
        .doc(creatorId)
        .collection('userFollowers')
        .limit(NOTIFICATION_BATCH_SIZE);
        
      // Apply pagination if we have a last document reference
      if (lastDocumentRef) {
        followersQuery = followersQuery.startAfter(lastDocumentRef);
      }
      
      const followersSnapshot = await followersQuery.get();
      
      if (followersSnapshot.empty) {
        hasMoreFollowers = false;
        break;
      }
      
      // Keep track of the last document for pagination
      lastDocumentRef = followersSnapshot.docs[followersSnapshot.docs.length - 1];
      
      // Skip if no followers in this batch
      if (followersSnapshot.empty) {
        continue;
      }
      
      const batch = admin.firestore().batch();
      let batchNotificationCount = 0;
      
      // Create notifications for followers in this batch
      followersSnapshot.docs.forEach(doc => {
        const followerId = doc.id;
        
        const notificationRef = admin.firestore()
          .collection('notifications')
          .doc();
        
        batch.set(notificationRef, {
          userId: followerId,
          type: 'tee-time-created',
          entityId: teeTimeId,
          entityType: 'tee-time',
          actorId: creatorId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            courseName: teeTimeData.courseName || '',
            date: dateTime.toISOString(),
            creatorName: creatorName
          }
        });
        
        // Update user's unread notification count
        const userRef = admin.firestore().collection('users').doc(followerId);
        batch.update(userRef, {
          unreadNotifications: admin.firestore.FieldValue.increment(1)
        });
        
        batchNotificationCount++;
      });
      
      if (batchNotificationCount > 0) {
        await batch.commit();
        totalNotificationsSent += batchNotificationCount;
        logger.info(`Sent batch of ${batchNotificationCount} follower notifications for tee time ${teeTimeId}`);
      }
      
      // If we got fewer results than the limit, there are no more followers
      if (followersSnapshot.docs.length < NOTIFICATION_BATCH_SIZE) {
        hasMoreFollowers = false;
      }
    } catch (error) {
      logger.error(`Error sending follower notifications for tee time ${teeTimeId}:`, error);
      // Continue with next batch despite errors
      hasMoreFollowers = false;
    }
  }
  
  if (totalNotificationsSent > 0) {
    logger.info(`Total of ${totalNotificationsSent} follower notifications sent for tee time ${teeTimeId}`);
  }
}

/**
 * When a tee time is updated, update the corresponding post
 */
export const onTeeTimeUpdated = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('teeTimes/{teeTimeId}')
  .onUpdate(async (change, context) => {
    const teeTimeId = context.params.teeTimeId;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    if (!beforeData || !afterData) {
      logger.error(`Missing data for tee time update ${teeTimeId}`);
      return false;
    }
    
    try {
      logger.info(`Processing tee time update: ${teeTimeId}`);
      
      // Skip if system update (creator not present)
      if (!afterData.creatorId) {
        return true;
      }
      
      // Find the post for this tee time
      const postsQuery = await admin.firestore()
        .collection('posts')
        .where('teeTimeId', '==', teeTimeId)
        .where('postType', '==', 'tee-time')
        .limit(1)
        .get();
      
      if (postsQuery.empty) {
        logger.warn(`No post found for tee time ${teeTimeId}`);
        return true;
      }
      
      const postDoc = postsQuery.docs[0];
      
      // Check for relevant changes that need post update
      const relevantChanges = [
        beforeData.courseName !== afterData.courseName,
        beforeData.dateTime?.toMillis() !== afterData.dateTime?.toMillis(),
        beforeData.maxPlayers !== afterData.maxPlayers,
        beforeData.visibility !== afterData.visibility,
        beforeData.status !== afterData.status
      ].some(Boolean);
      
      if (relevantChanges) {
        // Format date for post content
        const dateTime = afterData.dateTime instanceof admin.firestore.Timestamp 
          ? afterData.dateTime.toDate() 
          : new Date(afterData.dateTime || Date.now());
        
        // Create updated post content based on status
        let content = '';
        
        if (afterData.status === 'cancelled') {
          content = `This tee time at ${afterData.courseName || 'the golf course'} has been cancelled.`;
        } else {
          const remainingSpots = (afterData.maxPlayers || 4) - (afterData.currentPlayers || 1);
          content = `I'm hosting a tee time at ${afterData.courseName || 'the golf course'} on ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
          
          if (remainingSpots > 0) {
            content += ` Looking for ${remainingSpots} more ${remainingSpots === 1 ? 'player' : 'players'}!`;
          } else {
            content += ' This tee time is now full.';
          }
        }
        
        // Update the post
        await postDoc.ref.update({
          content: content,
          courseName: afterData.courseName || '',
          dateTime: afterData.dateTime || admin.firestore.Timestamp.fromDate(new Date()),
          maxPlayers: afterData.maxPlayers || 4,
          visibility: afterData.visibility === 'private' ? 'private' : 'public',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info(`Updated post ${postDoc.id} for tee time ${teeTimeId}`);
      }
      
      // Handle status changes for notifications
      if (beforeData.status !== afterData.status && afterData.status === 'cancelled') {
        await notifyCancellation(teeTimeId, afterData);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error processing tee time update ${teeTimeId}:`, error);
      return false;
    }
  });

/**
 * Helper function to notify players about cancellation with pagination
 */
async function notifyCancellation(teeTimeId: string, teeTimeData: any) {
  let lastDocumentRef = null;
  let hasMorePlayers = true;
  let totalNotificationsSent = 0;
  
  // Process players in batches with pagination
  while (hasMorePlayers) {
    try {
      // Build query with pagination
      let playersQuery = admin.firestore()
        .collection('teeTimes')
        .doc(teeTimeId)
        .collection('players')
        .where('status', '==', 'confirmed')
        .limit(NOTIFICATION_BATCH_SIZE);
        
      // Apply pagination if we have a last document reference
      if (lastDocumentRef) {
        playersQuery = playersQuery.startAfter(lastDocumentRef);
      }
      
      const playersSnapshot = await playersQuery.get();
      
      if (playersSnapshot.empty) {
        hasMorePlayers = false;
        break;
      }
      
      // Keep track of the last document for pagination
      lastDocumentRef = playersSnapshot.docs[playersSnapshot.docs.length - 1];
      
      const batch = admin.firestore().batch();
      let batchNotificationCount = 0;
      
      // Create notifications for players in this batch
      playersSnapshot.docs.forEach(doc => {
        const playerData = doc.data();
        
        // Skip creator
        if (playerData.userId === teeTimeData.creatorId) return;
        
        const notificationRef = admin.firestore()
          .collection('notifications')
          .doc();
        
        batch.set(notificationRef, {
          userId: playerData.userId,
          type: 'tee-time-cancelled',
          entityId: teeTimeId,
          entityType: 'tee-time',
          actorId: teeTimeData.creatorId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            courseName: teeTimeData.courseName || '',
            date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
              ? teeTimeData.dateTime.toDate().toISOString() 
              : new Date(teeTimeData.dateTime || Date.now()).toISOString()
          },
          priority: 'high'
        });
        
        // Update user's unread notification count
        const userRef = admin.firestore().collection('users').doc(playerData.userId);
        batch.update(userRef, {
          unreadNotifications: admin.firestore.FieldValue.increment(1)
        });
        
        batchNotificationCount++;
      });
      
      if (batchNotificationCount > 0) {
        await batch.commit();
        totalNotificationsSent += batchNotificationCount;
        logger.info(`Sent batch of ${batchNotificationCount} cancellation notifications for tee time ${teeTimeId}`);
      }
      
      // If we got fewer results than the limit, there are no more players
      if (playersSnapshot.docs.length < NOTIFICATION_BATCH_SIZE) {
        hasMorePlayers = false;
      }
    } catch (error) {
      logger.error(`Error sending cancellation notifications for tee time ${teeTimeId}:`, error);
      // Continue with next batch despite errors
      hasMorePlayers = false;
    }
  }
  
  if (totalNotificationsSent > 0) {
    logger.info(`Total of ${totalNotificationsSent} cancellation notifications sent for tee time ${teeTimeId}`);
  }
}

/**
 * When a tee time is deleted, delete associated resources
 */
export const onTeeTimeDeleted = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB', 
  })
  .firestore.document('teeTimes/{teeTimeId}')
  .onDelete(async (snapshot, context) => {
    const teeTimeId = context.params.teeTimeId;
    const teeTimeData = snapshot.data();
    
    if (!teeTimeData) {
      logger.error(`Missing data for deleted tee time ${teeTimeId}`);
      return false;
    }
    
    try {
      logger.info(`Processing tee time deletion: ${teeTimeId}`);
      
      // Use a batched write for associated deletions
      const batch = admin.firestore().batch();
      
      // Find and delete the associated post
      const postsQuery = await admin.firestore()
        .collection('posts')
        .where('teeTimeId', '==', teeTimeId)
        .where('postType', '==', 'tee-time')
        .limit(1)
        .get();
      
      if (!postsQuery.empty) {
        batch.delete(postsQuery.docs[0].ref);
      }
      
      // Find and delete notifications for this tee time (with pagination)
      await deleteRelatedNotifications(teeTimeId);
      
      // Execute the batch for post deletion
      await batch.commit();
      logger.info(`Cleaned up post for deleted tee time ${teeTimeId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error cleaning up deleted tee time ${teeTimeId}:`, error);
      return false;
    }
  });

/**
 * Helper function to delete notifications with pagination
 */
async function deleteRelatedNotifications(teeTimeId: string) {
  let lastDocumentRef = null;
  let hasMoreNotifications = true;
  let totalDeleted = 0;
  
  while (hasMoreNotifications) {
    try {
      // Build query with pagination
      let notificationsQuery = admin.firestore()
        .collection('notifications')
        .where('entityId', '==', teeTimeId)
        .where('entityType', '==', 'tee-time')
        .limit(MAX_BATCH_SIZE);
        
      // Apply pagination if we have a last document reference
      if (lastDocumentRef) {
        notificationsQuery = notificationsQuery.startAfter(lastDocumentRef);
      }
      
      const notificationsSnapshot = await notificationsQuery.get();
      
      if (notificationsSnapshot.empty) {
        hasMoreNotifications = false;
        break;
      }
      
      // Keep track of the last document for pagination
      lastDocumentRef = notificationsSnapshot.docs[notificationsSnapshot.docs.length - 1];
      
      const batch = admin.firestore().batch();
      let batchSize = 0;
      
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        batchSize++;
      });
      
      if (batchSize > 0) {
        await batch.commit();
        totalDeleted += batchSize;
        logger.info(`Deleted batch of ${batchSize} notifications for tee time ${teeTimeId}`);
      }
      
      // If we got fewer results than the limit, there are no more notifications
      if (notificationsSnapshot.docs.length < MAX_BATCH_SIZE) {
        hasMoreNotifications = false;
      }
    } catch (error) {
      logger.error(`Error deleting notifications for tee time ${teeTimeId}:`, error);
      // Continue with next batch despite errors
      hasMoreNotifications = false;
    }
  }
  
  logger.info(`Deleted total of ${totalDeleted} notifications for tee time ${teeTimeId}`);
}

/**
 * When a player joins or requests to join a tee time
 */
export const onPlayerAddedToTeeTime = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('teeTimes/{teeTimeId}/players/{playerId}')
  .onCreate(async (snapshot, context) => {
    const teeTimeId = context.params.teeTimeId;
    const playerId = context.params.playerId;
    const playerData = snapshot.data();
    
    if (!playerData) {
      logger.error(`Missing player data for ${playerId} in tee time ${teeTimeId}`);
      return false;
    }
    
    try {
      logger.info(`Player ${playerId} added to tee time ${teeTimeId}`);
      
      // Get tee time details
      const teeTimeDoc = await admin.firestore()
        .collection('teeTimes')
        .doc(teeTimeId)
        .get();
      
      if (!teeTimeDoc.exists) {
        logger.warn(`Tee time ${teeTimeId} not found for player ${playerId}`);
        return true;
      }
      
      const teeTimeData = teeTimeDoc.data();
      
      if (!teeTimeData) {
        logger.error(`Missing tee time data for ${teeTimeId}`);
        return false;
      }
      
      // Skip notification if player is the creator
      if (playerId === teeTimeData.creatorId) {
        logger.info(`Player ${playerId} is the creator, skipping notification`);
        return true;
      }
      
      // FIXED: Handle based on request type
      const batch = admin.firestore().batch();
      
      // Check if this is an invitation or a join request
      const isInvitation = playerData.requestType === 'invitation';
      const isJoinRequest = !isInvitation;
      
      if (isInvitation) {
        // FIXED: Player was invited - notify them to respond
        const notificationRef = admin.firestore()
          .collection('notifications')
          .doc();
        
        batch.set(notificationRef, {
          userId: playerId,
          type: 'tee-time-invite',
          entityId: teeTimeId,
          entityType: 'tee-time',
          actorId: playerData.invitedBy,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            courseName: teeTimeData.courseName || '',
            date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
              ? teeTimeData.dateTime.toDate().toISOString() 
              : new Date(teeTimeData.dateTime || Date.now()).toISOString(),
            actionType: 'respond_invitation'
          },
          priority: 'high'
        });
        
        // Update user's unread notification count
        const userRef = admin.firestore().collection('users').doc(playerId);
        batch.update(userRef, {
          unreadNotifications: admin.firestore.FieldValue.increment(1)
        });
      } else if (isJoinRequest) {
        // FIXED: Player requested to join - notify creator
        const notificationRef = admin.firestore()
          .collection('notifications')
          .doc();
        
        batch.set(notificationRef, {
          userId: teeTimeData.creatorId,
          type: 'tee-time-request',
          entityId: teeTimeId,
          entityType: 'tee-time',
          actorId: playerId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            courseName: teeTimeData.courseName || '',
            date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
              ? teeTimeData.dateTime.toDate().toISOString() 
              : new Date(teeTimeData.dateTime || Date.now()).toISOString(),
            actionType: 'approve_request'
          },
          priority: 'high'
        });
        
        // Update creator's unread notification count
        const creatorRef = admin.firestore().collection('users').doc(teeTimeData.creatorId);
        batch.update(creatorRef, {
          unreadNotifications: admin.firestore.FieldValue.increment(1)
        });
      }
      
      await batch.commit();
      
      return true;
    } catch (error) {
      logger.error(`Error processing player addition for tee time ${teeTimeId}, player ${playerId}:`, error);
      return false;
    }
  });

/**
 * When a player's status is updated in a tee time
 */
export const onPlayerUpdated = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('teeTimes/{teeTimeId}/players/{playerId}')
  .onUpdate(async (change, context) => {
    const teeTimeId = context.params.teeTimeId;
    const playerId = context.params.playerId;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    if (!beforeData || !afterData) {
      logger.error(`Missing player data for update in tee time ${teeTimeId}, player ${playerId}`);
      return false;
    }
    
    try {
      logger.info(`Player ${playerId} updated in tee time ${teeTimeId}`);
      
      // Check if status changed
      if (beforeData.status === afterData.status) {
        logger.info(`No status change for player ${playerId} in tee time ${teeTimeId}`);
        return true;
      }
      
      // Get tee time details
      const teeTimeDoc = await admin.firestore()
        .collection('teeTimes')
        .doc(teeTimeId)
        .get();
      
      if (!teeTimeDoc.exists) {
        logger.warn(`Tee time ${teeTimeId} not found for player ${playerId} update`);
        return true;
      }
      
      const teeTimeData = teeTimeDoc.data();
      
      if (!teeTimeData) {
        logger.error(`Missing tee time data for ${teeTimeId}`);
        return false;
      }
      
      // Handle different status transitions
      const statusTransition = `${beforeData.status}_to_${afterData.status}`;
      const batch = admin.firestore().batch();
      
      switch(statusTransition) {
        case 'pending_to_confirmed':
          // Player was approved or accepted invitation
          if (afterData.requestType === 'invitation' && afterData.respondedAt) {
            // Player accepted invitation - notify creator
            const notificationRef = admin.firestore()
              .collection('notifications')
              .doc();
            
            batch.set(notificationRef, {
              userId: teeTimeData.creatorId,
              type: 'tee-time-invitation-accepted',
              entityId: teeTimeId,
              entityType: 'tee-time',
              actorId: playerId,
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              data: {
                courseName: teeTimeData.courseName || '',
                date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
                  ? teeTimeData.dateTime.toDate().toISOString() 
                  : new Date(teeTimeData.dateTime || Date.now()).toISOString()
              }
            });
            
            // Update creator's unread notification count
            const creatorRef = admin.firestore().collection('users').doc(teeTimeData.creatorId);
            batch.update(creatorRef, {
              unreadNotifications: admin.firestore.FieldValue.increment(1)
            });
          } else if (afterData.requestType === 'join_request' || !afterData.requestType) {
            // Player was approved by creator - notify player
            const notificationRef = admin.firestore()
              .collection('notifications')
              .doc();
            
            batch.set(notificationRef, {
              userId: playerId,
              type: 'tee-time-approved',
              entityId: teeTimeId,
              entityType: 'tee-time',
              actorId: teeTimeData.creatorId,
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              data: {
                courseName: teeTimeData.courseName || '',
                date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
                  ? teeTimeData.dateTime.toDate().toISOString() 
                  : new Date(teeTimeData.dateTime || Date.now()).toISOString()
              }
            });
            
            // Update user's unread notification count
            const userRef = admin.firestore().collection('users').doc(playerId);
            batch.update(userRef, {
              unreadNotifications: admin.firestore.FieldValue.increment(1)
            });
          }
          
          // Update tee time player count and status
          batch.update(teeTimeDoc.ref, {
            currentPlayers: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: (teeTimeData.currentPlayers || 1) + 1 >= (teeTimeData.maxPlayers || 4) ? 'full' : 'open'
          });
          break;
          
        case 'pending_to_declined':
          // Player declined invitation - notify creator
          if (afterData.requestType === 'invitation' && afterData.respondedAt) {
            const notificationRef = admin.firestore()
              .collection('notifications')
              .doc();
            
            batch.set(notificationRef, {
              userId: teeTimeData.creatorId,
              type: 'tee-time-invitation-declined',
              entityId: teeTimeId,
              entityType: 'tee-time',
              actorId: playerId,
              isRead: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              data: {
                courseName: teeTimeData.courseName || '',
                date: teeTimeData.dateTime instanceof admin.firestore.Timestamp 
                  ? teeTimeData.dateTime.toDate().toISOString() 
                  : new Date(teeTimeData.dateTime || Date.now()).toISOString()
              }
            });
            
            // Update creator's unread notification count
            const creatorRef = admin.firestore().collection('users').doc(teeTimeData.creatorId);
            batch.update(creatorRef, {
              unreadNotifications: admin.firestore.FieldValue.increment(1)
            });
          }
          break;
          
        case 'confirmed_to_removed':
          // Player was removed after being confirmed - update player count
          batch.update(teeTimeDoc.ref, {
            currentPlayers: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'open' // If someone leaves a full tee time, it's now open again
          });
          break;
      }
      
      // Commit any notifications or updates
      if (batch.commit.length > 0) {
        await batch.commit();
      }
      
      return true;
    } catch (error) {
      logger.error(`Error processing player update for tee time ${teeTimeId}, player ${playerId}:`, error);
      return false;
    }
  });

/**
 * When a player is removed from a tee time
 */
export const onPlayerRemoved = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('teeTimes/{teeTimeId}/players/{playerId}')
  .onDelete(async (snapshot, context) => {
    const teeTimeId = context.params.teeTimeId;
    const playerId = context.params.playerId;
    const playerData = snapshot.data();
    
    if (!playerData) {
      logger.error(`Missing player data for ${playerId} in tee time ${teeTimeId}`);
      return false;
    }
    
    try {
      logger.info(`Player ${playerId} removed from tee time ${teeTimeId}`);
      
      // Skip if player was not confirmed
      if (playerData.status !== 'confirmed') {
        return true;
      }
      
      // Get tee time details
      const teeTimeDoc = await admin.firestore()
        .collection('teeTimes')
        .doc(teeTimeId)
        .get();
      
      if (!teeTimeDoc.exists) {
        logger.warn(`Tee time ${teeTimeId} not found for player ${playerId} removal`);
        return true;
      }
      
      const teeTimeData = teeTimeDoc.data();
      
      if (!teeTimeData) {
        logger.error(`Missing tee time data for ${teeTimeId}`);
        return false;
      }
      
      // Update tee time player count and status
      await teeTimeDoc.ref.update({
        currentPlayers: Math.max((teeTimeData.currentPlayers || 1) - 1, 1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'open' // If someone leaves a full tee time, it's now open again
      });
      
      logger.info(`Updated tee time status after confirmed player ${playerId} was removed from tee time ${teeTimeId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error processing player removal for tee time ${teeTimeId}, player ${playerId}:`, error);
      return false;
    }
  });

/**
 * Cleanup old tee times - Initial entrypoint for scheduled cleanup
 * Runs once a week to archive tee times older than 30 days
 */
export const cleanupOldTeeTimes = functions
  .runWith({
    timeoutSeconds: 540, // Increase timeout for larger batches
    memory: '1GB',       // Increase memory for larger datasets
  })
  .pubsub.schedule('every 168 hours')
  .onRun(async (context) => {
    try {
      logger.info('Starting cleanup of old tee times');
      
      const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - CLEANUP_DAYS_THRESHOLD * 24 * 60 * 60 * 1000)
      );
      
      // Start the cleanup process with the initial pagination
      await processTeeTimeCleanupBatch(thirtyDaysAgo);
      
      return true;
    } catch (error) {
      logger.error('Error in primary cleanup function:', error);
      throw error;
    }
  });

/**
 * Handle a continuation of the tee time cleanup process
 * Triggered by Pub/Sub for paginated operations
 */
export const continueTeeTimeCleanup = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.topic(CLEANUP_TASK_TOPIC)
  .onPublish(async (message) => {
    try {
      // Parse the message data
      const data = message.json;
      
      if (!data || !data.timestamp || !data.lastDocumentId) {
        logger.error('Invalid cleanup continuation message format');
        return false;
      }
      
      logger.info(`Continuing tee time cleanup from document ID: ${data.lastDocumentId}`);
      
      // Create the timestamp cutoff
      const timestampCutoff = admin.firestore.Timestamp.fromDate(
        new Date(data.timestamp)
      );
      
      // Get the last document reference
      const lastDocRef = await admin.firestore()
        .collection('teeTimes')
        .doc(data.lastDocumentId)
        .get();
      
      if (!lastDocRef.exists) {
        logger.error(`Last document reference ${data.lastDocumentId} not found for cleanup continuation`);
        return false;
      }
      
      // Continue the cleanup process with the last document for pagination
      await processTeeTimeCleanupBatch(timestampCutoff, lastDocRef);
      
      return true;
    } catch (error) {
      logger.error('Error in cleanup continuation function:', error);
      throw error;
    }
  });

/**
 * Helper function to process one batch of tee time cleanup
 * Implements pagination and triggers follow-up tasks if needed
 */
async function processTeeTimeCleanupBatch(
  timestampCutoff: admin.firestore.Timestamp,
  lastDocumentRef?: admin.firestore.DocumentSnapshot
) {
  try {
    // Build query with pagination
    let oldTeeTimesQuery = admin.firestore()
      .collection('teeTimes')
      .where('dateTime', '<', timestampCutoff)
      .orderBy('dateTime')
      .limit(MAX_BATCH_SIZE);
      
    // Apply pagination if we have a last document reference
    if (lastDocumentRef) {
      oldTeeTimesQuery = oldTeeTimesQuery.startAfter(lastDocumentRef);
    }
    
    const oldTeeTimesSnapshot = await oldTeeTimesQuery.get();
    
    if (oldTeeTimesSnapshot.empty) {
      logger.info('No more old tee times to clean up');
      return;
    }
    
    // Process batch of tee times
    const batch = admin.firestore().batch();
    let count = 0;
    
    // Keep track of the last document for pagination
    const lastProcessedDoc = oldTeeTimesSnapshot.docs[oldTeeTimesSnapshot.docs.length - 1];
    
    for (const doc of oldTeeTimesSnapshot.docs) {
      const docData = doc.data();
      if (!docData) continue;
      
      // Archive tee time to a historical collection
      const archiveRef = admin.firestore()
        .collection('teeTimesArchive')
        .doc(doc.id);
      
      batch.set(archiveRef, {
        ...docData,
        archivedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Delete the original
      batch.delete(doc.ref);
      
      count++;
    }
    
    // Check if we need to use multiple batches
    if (count > 0) {
      await batch.commit();
      logger.info(`Archived ${count} old tee times in batch`);
    }
    
    // If we hit the batch limit and there are likely more items, trigger a follow-up task
    if (oldTeeTimesSnapshot.size >= MAX_BATCH_SIZE) {
      logger.info(`Scheduling follow-up cleanup starting from document ID: ${lastProcessedDoc.id}`);
      
      // Create a continuation message
      const message = {
        timestamp: timestampCutoff.toMillis(),
        lastDocumentId: lastProcessedDoc.id,
        batchCount: count
      };
      
      // Use the PubSub client to publish a message
      const pubSubClient = new PubSub();
      await pubSubClient.topic(CLEANUP_TASK_TOPIC).publishMessage({
        data: Buffer.from(JSON.stringify(message))
      });
    }
  } catch (error) {
    logger.error('Error in batch cleanup process:', error);
    throw error;
  }
}

// Export all functions
export const teeTimeFunctions = {
  onTeeTimeCreated,
  onTeeTimeUpdated,
  onTeeTimeDeleted,
  onPlayerAddedToTeeTime,
  onPlayerUpdated,
  onPlayerRemoved,
  cleanupOldTeeTimes,
  continueTeeTimeCleanup
};
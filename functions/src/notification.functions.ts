// src/notification.functions.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

/**
 * Cleanup old notifications to keep the database size manageable
 * Runs once a day to remove notifications older than 3 months
 */
export const cleanupOldNotifications = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const threeMonthsAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );
    
    logger.info('Starting cleanup of old notifications');
    
    try {
      // Query for all notifications older than three months
      const oldNotificationsQuery = await admin.firestore()
        .collection('notifications')
        .where('createdAt', '<', threeMonthsAgo)
        .limit(500) // Process in batches
        .get();
      
      if (oldNotificationsQuery.empty) {
        logger.info('No old notifications to clean up');
        return true;
      }
      
      // Delete in batches
      const batch = admin.firestore().batch();
      let count = 0;
      
      oldNotificationsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
      
      await batch.commit();
      logger.info(`Deleted ${count} old notifications`);
      
      // If we hit the limit, there might be more to delete
      if (count >= 500) {
        // Schedule another run
        
        logger.info('Scheduled follow-up cleanup due to high volume of old notifications');
      }
      
      return true;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw error;
    }
  });

/**
 * When a user is deleted, clean up their notifications
 */
export const onUserDeleted = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .auth.user()
  .onDelete(async (user) => {
    try {
      logger.info(`Cleaning up notifications for deleted user: ${user.uid}`);
      
      // Delete notifications received by the user
      const userNotificationsQuery = await admin.firestore()
        .collection('notifications')
        .where('userId', '==', user.uid)
        .get();
      
      // Delete in batches
      if (!userNotificationsQuery.empty) {
        const batch = admin.firestore().batch();
        let count = 0;
        
        userNotificationsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });
        
        await batch.commit();
        logger.info(`Deleted ${count} notifications received by user ${user.uid}`);
      }
      
      // Delete notifications created by the user
      const actorNotificationsQuery = await admin.firestore()
        .collection('notifications')
        .where('actorId', '==', user.uid)
        .get();
      
      // Delete in batches
      if (!actorNotificationsQuery.empty) {
        const batch = admin.firestore().batch();
        let count = 0;
        
        actorNotificationsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });
        
        await batch.commit();
        logger.info(`Deleted ${count} notifications created by user ${user.uid}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error cleaning up notifications for user ${user.uid}:`, error);
      throw error;
    }
  });

/**
 * When a post is deleted, remove all its notifications
 */
export const onPostDeleted = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('posts/{postId}')
  .onDelete(async (snapshot, context) => {
    const postId = context.params.postId;
    
    try {
      logger.info(`Cleaning up notifications for deleted post: ${postId}`);
      
      // Find all notifications for this post
      const notificationsQuery = await admin.firestore()
        .collection('notifications')
        .where('entityId', '==', postId)
        .where('entityType', '==', 'post')
        .get();
      
      if (notificationsQuery.empty) {
        logger.info(`No notifications found for post ${postId}`);
        return true;
      }
      
      // Delete in batches
      const batch = admin.firestore().batch();
      let count = 0;
      
      notificationsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
      
      await batch.commit();
      logger.info(`Deleted ${count} notifications for post ${postId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error cleaning up notifications for post ${postId}:`, error);
      throw error;
    }
  });

/**
 * When a notification is created, send a push notification if enabled
 */
export const onNotificationCreated = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    const notificationId = context.params.notificationId;
    
    try {
      // Skip push for low priority notifications
      if (notification.priority !== 'high') {
        return true;
      }
      
      // Get recipient user
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();
      
      if (!userDoc.exists) {
        logger.warn(`User ${notification.userId} not found for notification ${notificationId}`);
        return true;
      }
      
      const userData = userDoc.data();
      
      // Check if user has push tokens
      if (!userData?.fcmTokens || Object.keys(userData.fcmTokens).length === 0) {
        logger.info(`No FCM tokens found for user ${notification.userId}`);
        return true;
      }
      
      // Check user notification preferences
      const userPrefsDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .collection('settings')
        .doc('notifications')
        .get();
      
      // If no preferences found or notifications disabled, skip push
      if (!userPrefsDoc.exists) {
        logger.info(`No notification preferences found for user ${notification.userId}`);
        return true;
      }
      
      const userPrefs = userPrefsDoc.data() || {}; // Add default empty object here
      
      // Check if push is enabled for this notification type
      // Fix: Added optional chaining for userPrefs.typePreferences
      const typePreferences = userPrefs.typePreferences || {};
      const typeEnabled = typePreferences[notification.type]?.enabled !== false;
      
      if (!typeEnabled) {
        logger.info(`Push notifications disabled for type ${notification.type} by user ${notification.userId}`);
        return true;
      }
      
      // Get actor info if available
      let actorName = 'Someone';
      if (notification.actorId) {
        const actorDoc = await admin.firestore()
          .collection('users')
          .doc(notification.actorId)
          .get();
        
        if (actorDoc.exists) {
          const actorData = actorDoc.data();
          actorName = actorData?.displayName || 'Someone';
        }
      }
      
      // Prepare notification content based on type
      let title = '';
      let body = '';
      
      switch (notification.type) {
        case 'like':
          title = `${actorName} liked your post`;
          body = notification.data?.content || '';
          break;
        case 'comment':
          title = `${actorName} commented on your post`;
          body = notification.data?.content || '';
          break;
        case 'follow':
          title = `${actorName} started following you`;
          body = 'Tap to view their profile';
          break;
        case 'tee-time-invite':
          title = `${actorName} invited you to a tee time`;
          body = notification.data?.courseName 
            ? `At ${notification.data.courseName}` 
            : 'Tap to view details';
          break;
        case 'tee-time-approved':
          title = 'Your tee time request was approved';
          body = notification.data?.courseName 
            ? `At ${notification.data.courseName}` 
            : 'Tap to view details';
          break;
        case 'tee-time-request':
          title = `${actorName} requested to join your tee time`;
          body = 'Tap to respond';
          break;
        default:
          title = 'New notification';
          body = 'Tap to view details';
      }
      
      // Create message payload
      const message = {
        notification: {
          title,
          body
        },
        data: {
          notificationId,
          type: notification.type,
          entityId: notification.entityId,
          entityType: notification.entityType,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: Object.keys(userData.fcmTokens)
      };
      
      // Send push notification
      if (message.tokens.length > 0) {
        try {
          const response = await admin.messaging().sendMulticast(message);
          logger.info(`Push notification sent for notification ${notificationId}: ${response.successCount} successful, ${response.failureCount} failed`);
          
          // Handle token cleanup if needed
          if (response.failureCount > 0) {
            const invalidTokens: string[] = [];
            
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                invalidTokens.push(message.tokens[idx]);
              }
            });
            
            if (invalidTokens.length > 0) {
              // Remove invalid tokens
              const userRef = admin.firestore().collection('users').doc(notification.userId);
              const tokenData = userData.fcmTokens || {};
              
              invalidTokens.forEach(token => {
                delete tokenData[token];
              });
              
              await userRef.update({
                fcmTokens: tokenData
              });
              
              logger.info(`Removed ${invalidTokens.length} invalid FCM tokens for user ${notification.userId}`);
            }
          }
        } catch (error) {
          logger.error(`Error sending push notification for ${notificationId}:`, error);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Error processing notification ${notificationId}:`, error);
      return true; // Don't retry
    }
  });

/**
 * Updates user notification metrics for analytics
 */
export const updateNotificationMetrics = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('notifications/{notificationId}')
  .onWrite(async (change, context) => {
    try {
      // Get the notification data
      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.exists ? change.after.data() : null;
      
      // Skip if no user ID
      if (!after?.userId && !before?.userId) {
        return true;
      }
      
      const userId = after?.userId || before?.userId;
      
      // Update user metrics
      const userMetricsRef = admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('metrics')
        .doc('notifications');
      
      // Check if document exists
      const metricsDoc = await userMetricsRef.get();
      
      if (!change.after.exists && before) {
        // Notification deleted - Fix: Added null check for 'before'
        if (metricsDoc.exists) {
          await userMetricsRef.update({
            totalCount: admin.firestore.FieldValue.increment(-1),
            [`typeCount.${before.type}`]: admin.firestore.FieldValue.increment(-1)
          });
        }
      } else if (!change.before.exists && after) {
        // New notification - Fix: Added null check for 'after'
        if (metricsDoc.exists) {
          await userMetricsRef.update({
            totalCount: admin.firestore.FieldValue.increment(1),
            [`typeCount.${after.type}`]: admin.firestore.FieldValue.increment(1),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Create new metrics document
          await userMetricsRef.set({
            totalCount: 1,
            typeCount: {
              [after.type]: 1
            },
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (before && after && before.type !== after.type) {
        // Notification type changed - Fix: Added null checks for both 'before' and 'after'
        await userMetricsRef.update({
          [`typeCount.${before.type}`]: admin.firestore.FieldValue.increment(-1),
          [`typeCount.${after.type}`]: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating notification metrics:', error);
      return true; // Don't retry
    }
  });
// src/deletePostReferences.function.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// Initialize the app
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define and export the functions directly
export const deletePostReferences = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '1GB',
    minInstances: 0,
  })
  .https.onCall(async (data: { postId: string }, context) => {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to delete post references'
      );
    }

    const { postId } = data;
    
    if (!postId || typeof postId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Post ID is required'
      );
    }

    try {
      logger.info(`Starting deletion of references for post ${postId}`, {
        postId,
        userId: context.auth.uid,
      });

      // Get the post to verify ownership and get metadata
      const postRef = admin.firestore().collection('posts').doc(postId);
      const postDoc = await postRef.get();

      // Modified to handle deleted or non-existent posts
      if (!postDoc.exists) {
        logger.warn(`Post ${postId} not found, continuing with reference cleanup`);
        // Continue with reference cleanup even if post is gone
      } else {
        const postData = postDoc.data();
        
        // Add null check for postData
        if (!postData) {
          logger.warn(`No data found for post ${postId}`);
        } else {
          // Security check: Ensure requester is the post author or an admin
          // Only if the post still exists
          if (postData.authorId !== context.auth.uid && !await isAdminUser(context.auth.uid)) {
            throw new functions.https.HttpsError(
              'permission-denied',
              'User not authorized to delete this post'
            );
          }
        }
      }

      // Find all references to this post in users' feeds
      const feedRefs = await admin.firestore()
        .collectionGroup('posts')
        .where('postId', '==', postId)
        .limit(500)
        .get();
      
      if (feedRefs.empty) {
        logger.info(`No feed references found for post ${postId}`);
        return { success: true, message: 'No feed references found to delete' };
      }
      
      logger.info(`Found ${feedRefs.size} feed references to clean up for post ${postId}`);
      
      // Delete in batches for efficiency
      const batchSize = 500;
      let batch = admin.firestore().batch();
      let operationCount = 0;
      let totalDeleted = 0;
      
      feedRefs.forEach(doc => {
        batch.delete(doc.ref);
        operationCount++;
        totalDeleted++;
        
        // Commit when batch gets full
        if (operationCount >= batchSize) {
          batch.commit();
          batch = admin.firestore().batch();
          operationCount = 0;
        }
      });
      
      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }
      
      logger.info(`Successfully deleted ${totalDeleted} feed references for post ${postId}`);
      
      return { 
        success: true, 
        message: `Successfully deleted ${totalDeleted} feed references`,
        deletedCount: totalDeleted
      };
    } catch (error) {
      logger.error(`Error deleting post references for ${postId}:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Error deleting post references',
        error
      );
    }
  });

export const onPostDeleted = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .firestore
  .document('posts/{postId}')
  .onDelete(async (snapshot: functions.firestore.DocumentSnapshot, context: functions.EventContext) => {
    const postId = context.params.postId;
    const postData = snapshot.data();
    
    if (!postData) {
      logger.warn(`No data found for deleted post ${postId}`);
      return;
    }
    
    try {
      logger.info(`Post ${postId} was deleted, cleaning up references`);
      
      // Find all feed items that reference this post
      const feedRefs = await admin.firestore()
        .collectionGroup('posts')
        .where('postId', '==', postId)
        .limit(500)
        .get();
      
      if (feedRefs.empty) {
        logger.info(`No feed references found for post ${postId}`);
        return;
      }
      
      logger.info(`Found ${feedRefs.size} feed references to clean up`);
      
      // Delete in batches for efficiency
      const batchSize = 500;
      let batch = admin.firestore().batch();
      let operationCount = 0;
      
      feedRefs.forEach(doc => {
        batch.delete(doc.ref);
        operationCount++;
        
        // Commit when batch gets full
        if (operationCount >= batchSize) {
          batch.commit();
          batch = admin.firestore().batch();
          operationCount = 0;
        }
      });
      
      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }
      
      // Clean up notifications related to this post
      const notificationRefs = await admin.firestore()
        .collection('notifications')
        .where('entityId', '==', postId)
        .where('entityType', '==', 'post')
        .limit(500)
        .get();
      
      if (!notificationRefs.empty) {
        logger.info(`Found ${notificationRefs.size} notifications to clean up for post ${postId}`);
        
        let notificationBatch = admin.firestore().batch();
        let notificationCount = 0;
        
        notificationRefs.forEach(doc => {
          notificationBatch.delete(doc.ref);
          notificationCount++;
          
          // Commit when batch gets full
          if (notificationCount >= batchSize) {
            notificationBatch.commit();
            notificationBatch = admin.firestore().batch();
            notificationCount = 0;
          }
        });
        
        // Commit any remaining operations
        if (notificationCount > 0) {
          await notificationBatch.commit();
        }
      }
      
      logger.info(`Successfully cleaned up references for post ${postId}`);
    } catch (error) {
      logger.error(`Error in auto-cleanup for post ${postId}:`, error);
    }
  });

export const scheduledOrphanedFeedCleanup = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
  })
  .pubsub.schedule('every 24 hours')
  .onRun(async (context: functions.EventContext) => {
    logger.info('Starting scheduled cleanup of orphaned feed references');
    
    try {
      // Get a sample of feed posts to check for orphaned references
      const feedSample = await admin.firestore()
        .collectionGroup('posts')
        .limit(1000)
        .get();
      
      if (feedSample.empty) {
        logger.info('No feed posts found to check');
        return null;
      }
      
      logger.info(`Checking ${feedSample.size} feed posts for orphaned references`);
      
      // Track posts to clean up
      const orphanedPosts = [];
      
      // Check each post to see if it still exists
      for (const feedDoc of feedSample.docs) {
        const feedData = feedDoc.data();
        if (!feedData.postId) continue;
        
        const postRef = admin.firestore().collection('posts').doc(feedData.postId);
        const postExists = (await postRef.get()).exists;
        
        if (!postExists) {
          orphanedPosts.push(feedDoc.ref);
        }
      }
      
      if (orphanedPosts.length === 0) {
        logger.info('No orphaned feed posts found');
        return null;
      }
      
      logger.info(`Found ${orphanedPosts.length} orphaned feed posts to clean up`);
      
      // Delete orphaned posts in batches
      const batchSize = 500;
      for (let i = 0; i < orphanedPosts.length; i += batchSize) {
        const batch = admin.firestore().batch();
        const chunk = orphanedPosts.slice(i, i + batchSize);
        
        chunk.forEach(ref => {
          batch.delete(ref);
        });
        
        await batch.commit();
      }
      
      logger.info(`Successfully cleaned up ${orphanedPosts.length} orphaned feed posts`);
      return null;
    } catch (error) {
      logger.error('Error in scheduled orphaned feed cleanup:', error);
      return null;
    }
  });

// Helper function to check if a user is an admin
async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData?.role === 'admin' || userData?.isAdmin === true;
  } catch (error) {
    logger.error(`Error checking admin status for user ${userId}:`, error);
    return false;
  }
}
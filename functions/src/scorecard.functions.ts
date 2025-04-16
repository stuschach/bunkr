// functions/src/scorecard.functions.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { HandicapService } from './handicap/handicapService';

const db = admin.firestore();

/**
 * Triggered when a scorecard is created or updated
 * Updates statistics, handles completed rounds, and updates handicap
 */
export const onScorecardUpdated = functions.firestore
  .document('scorecards/{scorecardId}')
  .onWrite(async (change, context) => {
    const scorecardId = context.params.scorecardId;
    
    // Check if document was deleted
    if (!change.after.exists) {
      // Document was deleted, handle cleanup
      await handleScorecardDeleted(scorecardId, change.before.data());
      return;
    }
    
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.data();
    
    // Early exit if data is invalid
    if (!afterData || !afterData.userId) {
      console.error('Invalid scorecard data:', afterData);
      return;
    }
    
    // Check if this is a newly completed round
    if (afterData.isCompleted && (!beforeData || !beforeData.isCompleted)) {
      // Round was just completed
      await handleCompletedRound(scorecardId, afterData);
    } else if (afterData.isCompleted && beforeData && beforeData.isCompleted) {
      // Round was already completed but was updated
      await handleUpdatedCompletedRound(scorecardId, beforeData, afterData);
    }
    
    // Always recalculate stats to ensure consistency
    await recalculateStats(scorecardId, afterData);
  });

/**
 * Handles cleanup when a scorecard is deleted
 */
async function handleScorecardDeleted(
  scorecardId: string,
  beforeData: any
): Promise<void> {
  if (!beforeData || !beforeData.userId) return;
  
  const userId = beforeData.userId;
  
  try {
    // Check if there are any posts referencing this scorecard
    const postsQuery = await db.collection('posts')
      .where('roundId', '==', scorecardId)
      .limit(10)
      .get();
    
    if (!postsQuery.empty) {
      const batch = db.batch();
      
      // Delete all posts referencing this scorecard
      postsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    }
    
    // Flag the user for handicap recalculation
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      handicapNeedsUpdate: true,
      handicapLastUpdateTrigger: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Cleanup completed for deleted scorecard ${scorecardId}`);
  } catch (error) {
    console.error('Error handling scorecard deletion:', error);
  }
}

/**
 * Handles a newly completed round
 */
async function handleCompletedRound(
  scorecardId: string,
  data: any
): Promise<void> {
  const userId = data.userId;
  
  try {
    // Update user's total rounds count
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      const totalRounds = (userData.totalRounds || 0) + 1;
      
      await userRef.update({
        totalRounds,
        lastRoundDate: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Update handicap if needed
    if (data.isPublic !== false) {
      await HandicapService.updateHandicapAfterRound(userId, scorecardId);
    }
    
    // Add activity to user's activity feed
    await db.collection('userActivity').add({
      userId,
      type: 'round_completed',
      resourceId: scorecardId,
      courseName: data.courseName,
      courseId: data.courseId,
      totalScore: data.totalScore,
      scoreToPar: data.scoreToPar,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Completed round handling for scorecard ${scorecardId}`);
  } catch (error) {
    console.error('Error handling completed round:', error);
  }
}

/**
 * Handles updates to an already completed round
 */
async function handleUpdatedCompletedRound(
  scorecardId: string,
  beforeData: any,
  afterData: any
): Promise<void> {
  const userId = afterData.userId;
  
  try {
    // Check if score changed significantly
    const scoreDifference = Math.abs(afterData.totalScore - beforeData.totalScore);
    
    if (scoreDifference > 0) {
      // Score changed, update handicap
      await HandicapService.updateHandicapAfterRound(userId, scorecardId);
    }
    
    console.log(`Updated completed round handling for scorecard ${scorecardId}`);
  } catch (error) {
    console.error('Error handling updated completed round:', error);
  }
}

/**
 * Recalculates statistics for a scorecard
 */
async function recalculateStats(
  scorecardId: string,
  data: any
): Promise<void> {
  try {
    // Get the holes data
    const holes = data.holes || [];
    if (holes.length === 0) return;
    
    // Calculate statistics
    const stats = calculateStats(holes);
    
    // Check if stats need updating
    if (
      stats.totalScore !== data.totalScore ||
      !data.stats ||
      stats.totalPutts !== data.stats.totalPutts ||
      stats.fairwaysHit !== data.stats.fairwaysHit ||
      stats.greensInRegulation !== data.stats.greensInRegulation
    ) {
      // Update the scorecard with correct stats
      await db.collection('scorecards').doc(scorecardId).update({
        stats,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - (data.coursePar || 72)
      });
      
      console.log(`Updated statistics for scorecard ${scorecardId}`);
    }
  } catch (error) {
    console.error('Error recalculating stats:', error);
  }
}

/**
 * Calculate statistics based on hole data
 */
function calculateStats(holes: any[]): any {
  let totalScore = 0;
  let totalPutts = 0;
  let fairwaysHit = 0;
  let fairwaysTotal = 0;
  let greensInRegulation = 0;
  let penalties = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doubleBogeys = 0;
  let worseThanDouble = 0;

  holes.forEach(hole => {
    // Only count holes with scores
    if (hole.score > 0) {
      totalScore += hole.score;
      totalPutts += hole.putts || 0;
      penalties += hole.penalties || 0;
      
      // Fairway hit (excludes par 3s)
      if (hole.par > 3) {
        fairwaysTotal++;
        if (hole.fairwayHit === true) fairwaysHit++;
      }
      
      // Green in regulation
      if (hole.greenInRegulation) greensInRegulation++;
      
      // Score classification
      const scoreToPar = hole.score - hole.par;
      if (scoreToPar <= -2) eagles++;
      else if (scoreToPar === -1) birdies++;
      else if (scoreToPar === 0) pars++;
      else if (scoreToPar === 1) bogeys++;
      else if (scoreToPar === 2) doubleBogeys++;
      else if (scoreToPar > 2) worseThanDouble++;
    }
  });

  return {
    totalScore,
    totalPutts,
    fairwaysHit,
    fairwaysTotal,
    greensInRegulation,
    penalties,
    eagles,
    birdies,
    pars,
    bogeys,
    doubleBogeys,
    worseThanDouble
  };
}

/**
 * Scheduled function to recalculate handicaps for users with recent rounds
 * Runs daily to ensure handicaps are up to date
 */
export const scheduledHandicapUpdate = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    try {
      // Get users who need handicap updates
      const usersQuery = await db.collection('users')
        .where('handicapNeedsUpdate', '==', true)
        .limit(100)
        .get();
      
      if (usersQuery.empty) {
        console.log('No users need handicap updates');
        return;
      }
      
      // Process each user
      const batch = db.batch();
      let updateCount = 0;
      
      for (const userDoc of usersQuery.docs) {
        const userId = userDoc.id;
        
        // Get recent scorecards
        const scorecardQuery = await db.collection('scorecards')
          .where('userId', '==', userId)
          .where('isCompleted', '==', true)
          .orderBy('date', 'desc')
          .limit(20)
          .get();
        
        if (!scorecardQuery.empty) {
          // Extract scorecard data
          const scorecards = scorecardQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Update handicap
          await HandicapService.calculateAndUpdateHandicap(userId, scorecards);
          updateCount++;
        }
        
        // Mark user as updated
        batch.update(userDoc.ref, {
          handicapNeedsUpdate: false,
          handicapLastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Commit all updates
      await batch.commit();
      
      console.log(`Updated handicaps for ${updateCount} users`);
    } catch (error) {
      console.error('Error in scheduled handicap update:', error);
    }
  });

/**
 * Triggered when a post referencing a scorecard is deleted
 * Updates the scorecard to remove the post reference
 */
export const onPostDeleted = functions.firestore
  .document('posts/{postId}')
  .onDelete(async (snapshot, context) => {
    const postData = snapshot.data();
    
    // Check if this is a scorecard-related post
    if (postData && postData.postType === 'round' && postData.roundId) {
      const scorecardId = postData.roundId;
      
      try {
        // Update the scorecard to remove the post reference
        const scorecardRef = db.collection('scorecards').doc(scorecardId);
        const scorecardDoc = await scorecardRef.get();
        
        if (scorecardDoc.exists) {
          const scorecardData = scorecardDoc.data() || {};
          
          // Ensure the postId array exists and remove this postId
          const postIds = scorecardData.postIds || [];
          const updatedPostIds = postIds.filter((id: string) => id !== context.params.postId);
          
          await scorecardRef.update({
            postIds: updatedPostIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`Removed post reference from scorecard ${scorecardId}`);
        }
      } catch (error) {
        console.error('Error updating scorecard after post deletion:', error);
      }
    }
  });

/**
 * Exports the functions to support local implementation of handicap service
 */
export const handicapFunctions = {
  calculateStats
};
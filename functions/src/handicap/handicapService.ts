// functions/src/handicap/handicapService.ts
import * as admin from 'firebase-admin';
import { getNumberOfDifferentialsToUse } from './calculator';

// Reference to Firestore
const db = admin.firestore();

// Define interfaces for type safety
interface TeeBox {
  name: string;
  rating: number;
  slope: number;
  yardage: number;
}

interface Scorecard {
  id: string;
  userId: string;
  totalScore: number;
  teeBox: TeeBox;
  isCompleted: boolean;
  date: string;
  [key: string]: any; // For other properties we might access
}

interface HandicapRecord {
  userId: string;
  handicapIndex: number;
  date: string;
  includedRounds: string[];
  differentials: number[];
  trend: 'improving' | 'declining' | 'stable';
  lowIndex: number;
  createdAt: admin.firestore.Timestamp;
}

/**
 * Service for handling handicap calculations and updates on the server
 */
export class HandicapService {
  /**
   * Update a user's handicap after a round is added or modified
   */
  static async updateHandicapAfterRound(userId: string, scorecardId: string): Promise<boolean> {
    try {
      // Get the user document
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.error(`User ${userId} not found for handicap update`);
        return false;
      }
      
      // Get the scorecard
      const scorecardRef = db.collection('scorecards').doc(scorecardId);
      const scorecardDoc = await scorecardRef.get();
      
      if (!scorecardDoc.exists) {
        console.error(`Scorecard ${scorecardId} not found for handicap update`);
        return false;
      }
      
      const scorecardData = scorecardDoc.data();
      
      // Skip if the round is not completed
      if (!scorecardData || !scorecardData.isCompleted) {
        return false;
      }
      
      // Fetch the user's recent rounds (last 20)
      const roundsQuery = db.collection('scorecards')
        .where('userId', '==', userId)
        .where('isCompleted', '==', true)
        .orderBy('date', 'desc')
        .limit(20);
      
      const roundsSnapshot = await roundsQuery.get();
      
      if (roundsSnapshot.empty) {
        // No rounds found
        return false;
      }
      
      // Map the documents to Scorecard objects with proper typing
      const rounds: Scorecard[] = [];
      roundsSnapshot.forEach(doc => {
        const data = doc.data();
        rounds.push({
          id: doc.id,
          userId: data.userId,
          totalScore: data.totalScore,
          teeBox: data.teeBox,
          isCompleted: data.isCompleted,
          date: data.date,
          ...data
        });
      });
      
      // Filter valid rounds (must have scores and course data)
      const validRounds = rounds.filter(round => 
        round.totalScore > 0 && 
        round.teeBox && 
        round.teeBox.rating && 
        round.teeBox.slope
      );
      
      if (validRounds.length < 3) {
        // Not enough rounds to calculate handicap (at least 3 required)
        return false;
      }
      
      // Calculate score differentials for each round
      const differentials = validRounds.map(round => {
        // Calculate score differential using USGA formula:
        // (Score - Course Rating) * 113 / Slope Rating
        const scoreRelativeToPar = round.totalScore - round.teeBox.rating;
        return (scoreRelativeToPar * 113) / round.teeBox.slope;
      });
      
      // Sort the differentials from lowest to highest
      const sortedDifferentials = [...differentials].sort((a, b) => a - b);
      
      // Determine how many differentials to use based on the count
      // Following USGA guidelines
      const count = sortedDifferentials.length;
      const numToUse = getNumberOfDifferentialsToUse(count);
      const usedDifferentials = sortedDifferentials.slice(0, numToUse);
      
      // Calculate the average of the used differentials
      const averageDifferential = usedDifferentials.reduce((sum, diff) => sum + diff, 0) / usedDifferentials.length;
      
      // Apply the 0.96 multiplier (per USGA formula)
      let handicapIndex = averageDifferential * 0.96;
      
      // Round to 1 decimal place
      handicapIndex = Math.round(handicapIndex * 10) / 10;
      
      // Cap maximum handicap at 54.0
      if (handicapIndex > 54.0) {
        handicapIndex = 54.0;
      }
      
      // Get the user's current handicap record
      const userHandicapRef = db.collection('handicapRecords').doc(`${userId}_latest`);
      const userHandicapSnap = await userHandicapRef.get();
      
      // Determine if this is a new record or an update
      let isNewRecord = true;
      let lowestIndex = handicapIndex;
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      
      if (userHandicapSnap.exists) {
        const currentHandicap = userHandicapSnap.data();
        if (currentHandicap) {
          isNewRecord = currentHandicap.handicapIndex !== handicapIndex;
          
          // Determine trend
          if (handicapIndex < currentHandicap.handicapIndex) {
            trend = 'improving'; // Lower handicap is better
          } else if (handicapIndex > currentHandicap.handicapIndex) {
            trend = 'declining';
          }
          
          // Track lowest handicap
          lowestIndex = Math.min(handicapIndex, currentHandicap.lowIndex || handicapIndex);
        }
      }
      
      if (isNewRecord) {
        // Create a new handicap record
        const recordId = `${userId}_${Date.now()}`;
        const handicapRecord: HandicapRecord = {
          userId,
          handicapIndex,
          date: new Date().toISOString().split('T')[0],
          includedRounds: validRounds.slice(0, numToUse).map(r => r.id), // Include the rounds used
          differentials: usedDifferentials,
          trend,
          lowIndex: lowestIndex,
          createdAt: admin.firestore.Timestamp.now()
        };
        
        // Save the record
        await db.collection('handicapRecords').doc(recordId).set(handicapRecord);
        
        // Also update the "latest" record
        await userHandicapRef.set(handicapRecord);
        
        // Update the user's profile with the new handicap index
        await userRef.update({
          handicapIndex,
          handicapUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error updating handicap after round:', error);
      return false;
    }
  }
  
  /**
   * Calculate and update a user's handicap index
   */
  static async calculateAndUpdateHandicap(
    userId: string, 
    inputScorecards?: any[]
  ): Promise<boolean> {
    try {
      // Get the user's completed rounds if not provided
      if (!inputScorecards || inputScorecards.length === 0) {
        const scorecardQuery = await db.collection('scorecards')
          .where('userId', '==', userId)
          .where('isCompleted', '==', true)
          .orderBy('date', 'desc')
          .limit(20)
          .get();
        
        if (scorecardQuery.empty) {
          // No scorecards found, reset handicap
          await db.collection('users').doc(userId).update({
            handicapIndex: null,
            handicapUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return true;
        }
        
        // Get at least one scorecard ID to call updateHandicapAfterRound
        const firstDoc = scorecardQuery.docs[0];
        if (firstDoc) {
          return await this.updateHandicapAfterRound(userId, firstDoc.id);
        }
        return false;
      }
      
      // If scorecards were provided, use the first one's ID to call updateHandicapAfterRound
      if (inputScorecards.length > 0 && inputScorecards[0].id) {
        return await this.updateHandicapAfterRound(userId, inputScorecards[0].id);
      }
      
      return false;
    } catch (error) {
      console.error('Error calculating handicap:', error);
      return false;
    }
  }
  
  /**
   * Get a user's current handicap index
   */
  static async getUserHandicapIndex(userId: string): Promise<number | null> {
    try {
      // Check if the user has a handicap record
      const userHandicapRef = db.collection('handicapRecords').doc(`${userId}_latest`);
      const userHandicapSnap = await userHandicapRef.get();
      
      if (userHandicapSnap.exists) {
        const data = userHandicapSnap.data();
        if (data && data.handicapIndex !== undefined) {
          return data.handicapIndex;
        }
      }
      
      // If no record exists, check user profile
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData && userData.handicapIndex !== undefined) {
          return userData.handicapIndex;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user handicap index:', error);
      return null;
    }
  }
  
  /**
   * Get a user's handicap history
   */
  static async getUserHandicapHistory(userId: string, limit = 10): Promise<any[]> {
    try {
      const handicapQuery = db.collection('handicapRecords')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(limit);
      
      const handicapSnapshot = await handicapQuery.get();
      
      if (handicapSnapshot.empty) {
        return [];
      }
      
      return handicapSnapshot.docs
        .filter(doc => doc.id !== `${userId}_latest`) // Exclude the "latest" record
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
    } catch (error) {
      console.error('Error getting handicap history:', error);
      return [];
    }
  }
}
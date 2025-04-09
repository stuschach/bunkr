// src/lib/handicap/handicapService.ts
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { calculateHandicapIndex } from '@/lib/handicap/calculator';
import { Scorecard } from '@/types/scorecard';

/**
 * Handicap service for updating and retrieving handicap data
 */
export class HandicapService {
  /**
   * Update a user's handicap after a new round is added or an existing round is updated
   * @param userId User ID
   * @param scorecardId ID of the newly added/updated scorecard
   */
  static async updateHandicapAfterRound(userId: string, scorecardId: string): Promise<void> {
    try {
      // Fetch the user's recent rounds (last 20)
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(20)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const rounds = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Scorecard));
      
      // Calculate the new handicap index
      const handicapIndex = calculateHandicapIndex(rounds);
      
      if (handicapIndex === null) {
        // Not enough rounds to calculate handicap (at least 3 required)
        return;
      }
      
      // Get the user's current handicap record
      const userHandicapRef = doc(db, 'handicapRecords', `${userId}_latest`);
      const userHandicapSnap = await getDoc(userHandicapRef);
      
      // Determine if this is a new record or an update
      let isNewRecord = true;
      let lowestIndex = handicapIndex;
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      
      if (userHandicapSnap.exists()) {
        const currentHandicap = userHandicapSnap.data();
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
      
      if (isNewRecord) {
        // Create a new handicap record
        const recordId = `${userId}_${Date.now()}`;
        const handicapRecord = {
          userId,
          handicapIndex,
          date: new Date().toISOString().split('T')[0],
          includedRounds: rounds.slice(0, 8).map(r => r.id), // Include the top 8 rounds used
          differentials: [], // Would normally include the score differentials
          trend,
          lowIndex: lowestIndex,
          createdAt: serverTimestamp()
        };
        
        // Save the record
        await setDoc(doc(db, 'handicapRecords', recordId), handicapRecord);
        
        // Also update the "latest" record
        await setDoc(userHandicapRef, handicapRecord);
        
        // Update the user's profile with the new handicap index
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          handicapIndex,
          handicapUpdatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating handicap:', error);
      throw error;
    }
  }
  
  /**
   * Get a user's current handicap index
   * @param userId User ID
   * @returns Handicap index or null if not available
   */
  static async getUserHandicapIndex(userId: string): Promise<number | null> {
    try {
      // Check if the user has a handicap record
      const userHandicapRef = doc(db, 'handicapRecords', `${userId}_latest`);
      const userHandicapSnap = await getDoc(userHandicapRef);
      
      if (userHandicapSnap.exists()) {
        return userHandicapSnap.data().handicapIndex;
      }
      
      // If no record exists, try to calculate one
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(20)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const rounds = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Scorecard));
      
      return calculateHandicapIndex(rounds);
    } catch (error) {
      console.error('Error getting user handicap:', error);
      return null;
    }
  }
  
  /**
   * Get a user's handicap history
   * @param userId User ID
   * @param limit Maximum number of records to return
   * @returns Array of handicap records
   */
  static async getUserHandicapHistory(userId: string, limit = 10): Promise<any[]> {
    try {
      const handicapQuery = query(
        collection(db, 'handicapRecords'),
        where('userId', '==', userId),
        where('recordId', '!=', `${userId}_latest`), // Exclude the "latest" record
        orderBy('date', 'desc'),
        limit
      );
      
      const handicapSnapshot = await getDocs(handicapQuery);
      return handicapSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting handicap history:', error);
      return [];
    }
  }
}
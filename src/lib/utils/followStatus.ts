// src/lib/utils/followStatus.ts

import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Checks if a user is following another user with robust error handling
 * @param userId The ID of the user that might be following
 * @param targetUserId The ID of the user that might be followed
 * @returns Promise<boolean> True if userId is following targetUserId
 */
export const checkFollowStatus = async (userId: string, targetUserId: string): Promise<boolean> => {
  if (!userId || !targetUserId) {
    console.error('Invalid user IDs provided to checkFollowStatus', { userId, targetUserId });
    return false;
  }
  
  if (userId === targetUserId) {
    return false; // Users can't follow themselves
  }
  
  try {
    // Direct document reference approach - most efficient
    const connectionRef = doc(db, 'users', userId, 'connections', targetUserId);
    const docSnap = await getDoc(connectionRef);
    
    const isFollowing = docSnap.exists() && 
                       docSnap.data()?.type === 'following' && 
                       docSnap.data()?.active === true;
                       
    console.log(`[checkFollowStatus] ${userId} following ${targetUserId}: ${isFollowing}`);
    return isFollowing;
  } catch (error) {
    console.error('Error checking follow status:', error);
    
    // Fallback approach in case of error - query-based
    try {
      const followingQuery = query(
        collection(db, 'users', userId, 'connections'),
        where('userId', '==', targetUserId),
        where('type', '==', 'following'),
        where('active', '==', true)
      );
      
      const querySnapshot = await getDocs(followingQuery);
      return !querySnapshot.empty;
    } catch (fallbackError) {
      console.error('Error in fallback follow status check:', fallbackError);
      return false;
    }
  }
};

/**
 * Gets the follower count for a user directly from the connections
 * @param userId The user ID to check
 * @returns Promise<number> The number of followers
 */
export const getActualFollowerCount = async (userId: string): Promise<number> => {
  try {
    const followersQuery = query(
      collection(db, 'users', userId, 'connections'),
      where('type', '==', 'follower'),
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(followersQuery);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting follower count:', error);
    return 0;
  }
};

/**
 * Updates the stored follower count to match the actual number of followers
 * @param userId The user ID to update
 * @returns Promise<number> The corrected follower count
 */
export const syncFollowerCount = async (userId: string): Promise<number> => {
  try {
    // Get the actual count from connections
    const actualCount = await getActualFollowerCount(userId);
    
    // Get the user document
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    // If the document exists and the count is different, update it
    if (userDoc.exists()) {
      const storedCount = userDoc.data()?.followerCount || 0;
      
      if (actualCount !== storedCount) {
        // FIXED: Use updateDoc function rather than userRef.update()
        await updateDoc(userRef, {
          followerCount: actualCount
        });
        console.log(`[syncFollowerCount] Updated follower count for ${userId} from ${storedCount} to ${actualCount}`);
      }
    }
    
    return actualCount;
  } catch (error) {
    console.error('Error syncing follower count:', error);
    return -1;
  }
};
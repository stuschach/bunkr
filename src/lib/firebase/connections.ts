// src/lib/firebase/connections.ts

import { collection, query, where, getDocs, getDoc, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from './config';

// Get follower count for a user
export const getFollowerCount = async (userId: string): Promise<number> => {
  try {
    const connectionsRef = collection(db, 'users', userId, 'connections');
    const q = query(
      connectionsRef, 
      where('type', '==', 'follower'), 
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting follower count:', error);
    return 0;
  }
};

// Get following count for a user
export const getFollowingCount = async (userId: string): Promise<number> => {
  try {
    const connectionsRef = collection(db, 'users', userId, 'connections');
    const q = query(
      connectionsRef, 
      where('type', '==', 'following'), 
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting following count:', error);
    return 0;
  }
};

// Check if user is following another user
export const isFollowing = async (userId: string, targetUserId: string): Promise<boolean> => {
  try {
    const connectionRef = doc(db, 'users', userId, 'connections', targetUserId);
    const docSnap = await getDoc(connectionRef);
    
    // Ensure we're checking both existence, type and active status
    return docSnap.exists() && 
           docSnap.data().type === 'following' && 
           docSnap.data().active === true;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

// Fix inconsistencies between follower count and actual followers
export const reconcileFollowerCount = async (userId: string): Promise<number> => {
  try {
    // Get the actual count from connections
    const actualCount = await getFollowerCount(userId);
    
    // Get the stored count from user document
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const storedCount = userDoc.exists() ? (userDoc.data()?.followerCount || 0) : 0;
    
    // If there's a discrepancy, update the stored count
    if (actualCount !== storedCount) {
      await runTransaction(db, async (transaction) => {
        // Get fresh user document
        const freshUserDoc = await transaction.get(userRef);
        if (freshUserDoc.exists()) {
          transaction.update(userRef, {
            followerCount: actualCount
          });
        }
      });
    }
    
    return actualCount;
  } catch (error) {
    console.error('Error reconciling follower count:', error);
    return -1; // Error indicator
  }
};

// Get followers for a user
export const getFollowers = async (userId: string, limit = 20): Promise<string[]> => {
  try {
    const connectionsRef = collection(db, 'users', userId, 'connections');
    const q = query(
      connectionsRef, 
      where('type', '==', 'follower'), 
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().userId);
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
};

// Get users that a user is following
export const getFollowing = async (userId: string, limit = 20): Promise<string[]> => {
  try {
    const connectionsRef = collection(db, 'users', userId, 'connections');
    const q = query(
      connectionsRef, 
      where('type', '==', 'following'), 
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().userId);
  } catch (error) {
    console.error('Error getting following users:', error);
    return [];
  }
};
// src/lib/firebase/connections.ts

import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
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
    
    return docSnap.exists() && docSnap.data().type === 'following' && docSnap.data().active === true;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
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
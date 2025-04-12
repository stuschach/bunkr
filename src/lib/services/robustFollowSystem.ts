// src/lib/services/robustFollowSystem.ts
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    increment, 
    serverTimestamp,
    writeBatch,
    onSnapshot,
    Unsubscribe,
    collection,
    query,
    where,
    getDocs,
    runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// Replace simple cache with proper operation locks
const operationLocks = new Map<string, Promise<any>>();

/**
 * Helper function to generate consistent connection document IDs
 */
function getConnectionId(type: 'following' | 'follower', userId: string): string {
  return `${type}_${userId}`;
}

/**
 * A robust follow system that handles follow/unfollow operations,
 * manages follower counts, and provides tools to repair inconsistencies.
 */
export class RobustFollowSystem {
  
  // Active listeners
  private static listeners = new Map<string, Unsubscribe>();
  
  /**
   * Follow a user with batched writes and idempotent operations
   */
  static async followUser(
    currentUserId: string, 
    targetUserId: string
  ): Promise<{ success: boolean; followerCount: number; isFollowing: boolean }> {
    // Create a lock key for this operation
    const lockKey = `follow:${currentUserId}:${targetUserId}`;
    
    // If there's already an operation in progress, wait for it
    if (operationLocks.has(lockKey)) {
      await operationLocks.get(lockKey);
      const state = await this.getCurrentFollowState(currentUserId, targetUserId);
      return { ...state, success: true };
    }
    
    // Create a new operation promise
    const operationPromise = (async () => {
      try {
        // Prevent self-following
        if (currentUserId === targetUserId) {
          console.error('Cannot follow yourself');
          return { success: false, followerCount: 0, isFollowing: false };
        }
    
        // Get the current state to make this operation idempotent
        const currentState = await this.getCurrentFollowState(currentUserId, targetUserId);
        if (currentState.isFollowing) {
          return { success: true, followerCount: currentState.followerCount, isFollowing: true };
        }
    
        // Create a batch for atomicity
        const batch = writeBatch(db);
        
        // 1. Add following connection with new compound ID format
        const followingDocRef = doc(
          db, 
          'users', 
          currentUserId, 
          'connections', 
          getConnectionId('following', targetUserId)
        );
        
        batch.set(followingDocRef, {
          userId: targetUserId,
          type: 'following',
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        // 2. Add follower connection with new compound ID format
        const followerDocRef = doc(
          db, 
          'users', 
          targetUserId, 
          'connections', 
          getConnectionId('follower', currentUserId)
        );
        
        batch.set(followerDocRef, {
          userId: currentUserId,
          type: 'follower',
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        // 3. Update follower count for target user - SAFELY
        const targetUserDocRef = doc(db, 'users', targetUserId);
        const targetUserDoc = await getDoc(targetUserDocRef);
        if (targetUserDoc.exists()) {
          batch.update(targetUserDocRef, {
            followerCount: increment(1)
          });
        } else {
          batch.set(targetUserDocRef, {
            followerCount: 1
          }, { merge: true });
        }
        
        // 4. Update following count for current user - SAFELY
        const currentUserDocRef = doc(db, 'users', currentUserId);
        const currentUserDoc = await getDoc(currentUserDocRef);
        if (currentUserDoc.exists()) {
          batch.update(currentUserDocRef, {
            followingCount: increment(1)
          });
        } else {
          batch.set(currentUserDocRef, {
            followingCount: 1
          }, { merge: true });
        }
        
        // 5. Add a follow record
        const followRecordRef = doc(db, 'followRecords', `${currentUserId}_${targetUserId}`);
        batch.set(followRecordRef, {
          followerId: currentUserId,
          followingId: targetUserId,
          active: true,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
        
        // Execute the batch
        await batch.commit();
        
        console.log(`User ${currentUserId} followed ${targetUserId}`);
        
        // Get the new follower count
        const updatedTargetUser = await getDoc(targetUserDocRef);
        const newFollowerCount = updatedTargetUser.exists() ? (updatedTargetUser.data().followerCount || 1) : 1;
        
        // Schedule a consistency check
        setTimeout(() => {
          this.verifyFollowState(currentUserId, targetUserId).catch(err => 
            console.error('Follow verification error:', err)
          );
        }, 5000);
        
        return { success: true, followerCount: newFollowerCount, isFollowing: true };
      } catch (error) {
        console.error('Follow operation failed:', error);
        
        // Try to repair the relationship
        setTimeout(() => {
          this.repairFollowRelationship(currentUserId, targetUserId).catch(err => 
            console.error('Follow repair error:', err)
          );
        }, 1000);
        
        // Return the current state
        const state = await this.getCurrentFollowState(currentUserId, targetUserId);
        return { success: false, followerCount: state.followerCount, isFollowing: state.isFollowing };
      }
    })();
    
    // Store the operation promise and clean up when done
    operationLocks.set(lockKey, operationPromise);
    
    try {
      return await operationPromise;
    } finally {
      operationLocks.delete(lockKey);
    }
  }
  
  /**
   * Unfollow a user with batched writes and idempotent operations
   */
  static async unfollowUser(
    currentUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean; followerCount: number; isFollowing: boolean }> {
    // Create a lock key for this operation
    const lockKey = `unfollow:${currentUserId}:${targetUserId}`;
    
    // If there's already an operation in progress, wait for it
    if (operationLocks.has(lockKey)) {
      await operationLocks.get(lockKey);
      const state = await this.getCurrentFollowState(currentUserId, targetUserId);
      return { ...state, success: true };
    }
    
    // Create a new operation promise
    const operationPromise = (async () => {
      try {
        // Get the current state to make this operation idempotent
        const currentState = await this.getCurrentFollowState(currentUserId, targetUserId);
        if (!currentState.isFollowing) {
          return { success: true, followerCount: currentState.followerCount, isFollowing: false };
        }
    
        // Create a batch for atomicity
        const batch = writeBatch(db);
        
        // 1. Update following connection using compound ID
        const followingDocRef = doc(
          db, 
          'users', 
          currentUserId, 
          'connections', 
          getConnectionId('following', targetUserId)
        );
        
        batch.set(followingDocRef, {
          userId: targetUserId,
          type: 'following',
          active: false,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // 2. Update follower connection using compound ID
        const followerDocRef = doc(
          db, 
          'users', 
          targetUserId, 
          'connections', 
          getConnectionId('follower', currentUserId)
        );
        
        batch.set(followerDocRef, {
          userId: currentUserId,
          type: 'follower',
          active: false,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // 3. Update follower count for target user - SAFELY
        const targetUserDocRef = doc(db, 'users', targetUserId);
        const targetUserDoc = await getDoc(targetUserDocRef);
        const currentFollowerCount = targetUserDoc.exists() ? (targetUserDoc.data().followerCount || 0) : 0;
        
        // Only decrement if the count is greater than 0
        if (currentFollowerCount > 0) {
          batch.update(targetUserDocRef, {
            followerCount: increment(-1)
          });
        } else {
          // Fix corrupted data
          batch.update(targetUserDocRef, {
            followerCount: 0
          });
        }
        
        // 4. Update following count for current user - SAFELY
        const currentUserDocRef = doc(db, 'users', currentUserId);
        const currentUserDoc = await getDoc(currentUserDocRef);
        const currentFollowingCount = currentUserDoc.exists() ? (currentUserDoc.data().followingCount || 0) : 0;
        
        // Only decrement if the count is greater than 0
        if (currentFollowingCount > 0) {
          batch.update(currentUserDocRef, {
            followingCount: increment(-1)
          });
        } else {
          // Fix corrupted data
          batch.update(currentUserDocRef, {
            followingCount: 0
          });
        }
        
        // 5. Update the follow record
        const followRecordRef = doc(db, 'followRecords', `${currentUserId}_${targetUserId}`);
        batch.set(followRecordRef, {
          followerId: currentUserId,
          followingId: targetUserId,
          active: false,
          lastUpdated: serverTimestamp()
        }, { merge: true });
        
        // Execute the batch
        await batch.commit();
        
        console.log(`User ${currentUserId} unfollowed ${targetUserId}`);
        
        // Get the new follower count
        const updatedTargetUser = await getDoc(targetUserDocRef);
        const newFollowerCount = updatedTargetUser.exists() 
          ? Math.max(0, updatedTargetUser.data().followerCount || 0) 
          : 0;
        
        // Schedule a consistency check
        setTimeout(() => {
          this.verifyFollowState(currentUserId, targetUserId).catch(err => 
            console.error('Unfollow verification error:', err)
          );
        }, 5000);
        
        return { success: true, followerCount: newFollowerCount, isFollowing: false };
      } catch (error) {
        console.error('Unfollow operation failed:', error);
        
        // Try to repair
        setTimeout(() => {
          this.repairFollowRelationship(currentUserId, targetUserId).catch(err => 
            console.error('Unfollow repair error:', err)
          );
        }, 1000);
        
        // Return current state
        const state = await this.getCurrentFollowState(currentUserId, targetUserId);
        return { success: false, followerCount: state.followerCount, isFollowing: state.isFollowing };
      }
    })();
    
    // Store the operation promise and clean up when done
    operationLocks.set(lockKey, operationPromise);
    
    try {
      return await operationPromise;
    } finally {
      operationLocks.delete(lockKey);
    }
  }
  
  /**
   * Toggle follow status
   */
  static async toggleFollowStatus(
    currentUserId: string,
    targetUserId: string
  ): Promise<{ isFollowing: boolean; followerCount: number }> {
    try {
      // Get current state
      const currentState = await this.getCurrentFollowState(currentUserId, targetUserId);
      
      // Toggle based on current state
      if (currentState.isFollowing) {
        const result = await this.unfollowUser(currentUserId, targetUserId);
        return {
          isFollowing: result.isFollowing,
          followerCount: result.followerCount
        };
      } else {
        const result = await this.followUser(currentUserId, targetUserId);
        return {
          isFollowing: result.isFollowing,
          followerCount: result.followerCount
        };
      }
    } catch (error) {
      console.error('Toggle follow status failed:', error);
      
      // Return current state in case of failure
      return this.getCurrentFollowState(currentUserId, targetUserId);
    }
  }
  
  /**
   * Get the current follow state between two users
   */
  static async getCurrentFollowState(
    currentUserId: string,
    targetUserId: string
  ): Promise<{ isFollowing: boolean; followerCount: number }> {
    try {
      // Check if currently following using the compound ID
      const followingDocRef = doc(
        db,
        'users',
        currentUserId,
        'connections',
        getConnectionId('following', targetUserId)
      );
      
      const followingDoc = await getDoc(followingDocRef);
      
      const isFollowing = followingDoc.exists() && 
                       followingDoc.data().active === true;
      
      // Get target user's follower count
      const targetUserDocRef = doc(db, 'users', targetUserId);
      const targetUserDoc = await getDoc(targetUserDocRef);
      
      let followerCount = targetUserDoc.exists() ? (targetUserDoc.data().followerCount || 0) : 0;
      
      // Ensure follower count is never negative
      if (followerCount < 0) {
        // Fix the count via transaction to ensure atomicity
        try {
          await runTransaction(db, async (transaction) => {
            const freshDoc = await transaction.get(targetUserDocRef);
            if (freshDoc.exists()) {
              transaction.update(targetUserDocRef, { followerCount: 0 });
            }
          });
          followerCount = 0;
        } catch (err) {
          console.error('Error fixing negative follower count:', err);
        }
      }
      
      return { isFollowing, followerCount };
    } catch (error) {
      console.error('Error getting follow state:', error);
      return { isFollowing: false, followerCount: 0 };
    }
  }
  
  /**
   * Get a user's following count
   */
  static async getFollowingCount(userId: string): Promise<number> {
    try {
      // Try to get from user document first (faster)
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const followingCount = userDoc.data().followingCount || 0;
        
        // Verify count periodically by scheduling background check
        if (Math.random() < 0.1) { // 10% chance for background verification
          this.countActiveConnections(userId, 'following')
            .then(actualCount => {
              if (actualCount !== followingCount) {
                console.log(`Found following count discrepancy for ${userId}, fixing...`);
                this.restoreFollowingCount(userId);
              }
            })
            .catch(err => console.error('Error in background following count check:', err));
        }
        
        return followingCount;
      }
      
      // Fallback to direct count if document doesn't exist
      return this.countActiveConnections(userId, 'following');
    } catch (error) {
      console.error('Error getting following count:', error);
      return 0;
    }
  }
  
  /**
   * Subscribe to changes in follow status and follower count
   */
  static subscribeToFollowState(
    currentUserId: string,
    targetUserId: string,
    callback: (state: { isFollowing: boolean; followerCount: number }) => void
  ): Unsubscribe {
    const key = `${currentUserId}_${targetUserId}`;
    
    // Clear any existing listener
    if (this.listeners.has(key)) {
      this.listeners.get(key)?.();
      this.listeners.delete(key);
    }
    
    // Set up new listeners with compound IDs
    const followingDocRef = doc(
      db, 
      'users', 
      currentUserId, 
      'connections', 
      getConnectionId('following', targetUserId)
    );
    
    const targetUserDocRef = doc(db, 'users', targetUserId);
    
    // We need to track both states
    let isFollowing = false;
    let followerCount = 0;
    
    // Listen for follow status changes
    const followListener = onSnapshot(followingDocRef, (doc) => {
      isFollowing = doc.exists() && doc.data()?.active === true;
      callback({ isFollowing, followerCount });
    });
    
    // Listen for follower count changes
    const countListener = onSnapshot(targetUserDocRef, (doc) => {
      if (doc.exists()) {
        followerCount = Math.max(0, doc.data().followerCount || 0); // Ensure non-negative
        callback({ isFollowing, followerCount });
      }
    });
    
    // Combined unsubscribe function
    const unsubscribe = () => {
      followListener();
      countListener();
      this.listeners.delete(key);
    };
    
    // Store unsubscribe function
    this.listeners.set(key, unsubscribe);
    
    return unsubscribe;
  }
  
  /**
   * Subscribe to a user's follower and following counts
   */
  static subscribeToUserCounts(
    userId: string,
    callback: (counts: { followerCount: number; followingCount: number }) => void
  ): Unsubscribe {
    const key = `counts_${userId}`;
    
    // Clear any existing listener
    if (this.listeners.has(key)) {
      this.listeners.get(key)?.();
      this.listeners.delete(key);
    }
    
    // Listen for changes to user document
    const userDocRef = doc(db, 'users', userId);
    
    const listener = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const followerCount = Math.max(0, data.followerCount || 0); // Ensure non-negative
        const followingCount = Math.max(0, data.followingCount || 0); // Ensure non-negative
        
        callback({ followerCount, followingCount });
      } else {
        callback({ followerCount: 0, followingCount: 0 });
      }
    });
    
    // Store unsubscribe function
    this.listeners.set(key, listener);
    
    return listener;
  }
  
  /**
   * Verify the consistency of follow state and repair if needed
   */
  static async verifyFollowState(
    currentUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    try {
      console.log(`Verifying follow state between ${currentUserId} and ${targetUserId}`);
      
      // 1. Get all related documents using compound IDs
      const followingDocRef = doc(
        db, 
        'users', 
        currentUserId, 
        'connections', 
        getConnectionId('following', targetUserId)
      );
      
      const followerDocRef = doc(
        db, 
        'users', 
        targetUserId, 
        'connections', 
        getConnectionId('follower', currentUserId)
      );
      
      const recordRef = doc(db, 'followRecords', `${currentUserId}_${targetUserId}`);
      const targetUserRef = doc(db, 'users', targetUserId);
      const currentUserRef = doc(db, 'users', currentUserId);
      
      const [followingDoc, followerDoc, recordDoc, targetUserDoc, currentUserDoc] = 
        await Promise.all([
          getDoc(followingDocRef),
          getDoc(followerDocRef),
          getDoc(recordRef),
          getDoc(targetUserRef),
          getDoc(currentUserRef)
        ]);
      
      // 2. Check the follow state
      const isActiveFollowing = followingDoc.exists() && followingDoc.data().active === true;
      const isActiveFollower = followerDoc.exists() && followerDoc.data().active === true;
      const isActiveRecord = recordDoc.exists() && recordDoc.data().active === true;
      
      // If all states match, everything is consistent
      if (isActiveFollowing === isActiveFollower && isActiveFollowing === isActiveRecord) {
        return true;
      }
      
      // Otherwise, repair the relationship
      console.log('Inconsistent follow state detected, repairing...');
      return this.repairFollowRelationship(currentUserId, targetUserId);
    } catch (error) {
      console.error('Error verifying follow state:', error);
      return false;
    }
  }
  
  /**
   * Repair a follow relationship that might be in an inconsistent state
   */
  static async repairFollowRelationship(
    currentUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    try {
      console.log(`Repairing follow relationship between ${currentUserId} and ${targetUserId}`);
      
      // 1. Get all relevant documents using compound IDs
      const followingDocRef = doc(
        db, 
        'users', 
        currentUserId, 
        'connections', 
        getConnectionId('following', targetUserId)
      );
      
      const followerDocRef = doc(
        db, 
        'users', 
        targetUserId, 
        'connections', 
        getConnectionId('follower', currentUserId)
      );
      
      const recordRef = doc(db, 'followRecords', `${currentUserId}_${targetUserId}`);
      const targetUserRef = doc(db, 'users', targetUserId);
      const currentUserRef = doc(db, 'users', currentUserId);
      
      const [followingDoc, followerDoc, recordDoc, targetUserDoc, currentUserDoc] = 
        await Promise.all([
          getDoc(followingDocRef),
          getDoc(followerDocRef),
          getDoc(recordRef),
          getDoc(targetUserRef),
          getDoc(currentUserRef)
        ]);
      
      // 2. Determine what the true state should be
      // We'll trust the follow record as the source of truth
      const isFollowing = recordDoc.exists() && recordDoc.data().active === true;
      
      // 3. Prepare a batch to fix any inconsistencies
      const batch = writeBatch(db);
      let needsRepair = false;
      
      // 4. Fix following document if needed
      const followingExists = followingDoc.exists();
      const followingActive = followingExists && followingDoc.data().active === true;
      
      if (isFollowing !== followingActive) {
        needsRepair = true;
        batch.set(followingDocRef, {
          userId: targetUserId,
          type: 'following',
          active: isFollowing,
          updatedAt: serverTimestamp(),
          ...(followingExists ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });
      }
      
      // 5. Fix follower document if needed
      const followerExists = followerDoc.exists();
      const followerActive = followerExists && followerDoc.data().active === true;
      
      if (isFollowing !== followerActive) {
        needsRepair = true;
        batch.set(followerDocRef, {
          userId: currentUserId,
          type: 'follower',
          active: isFollowing,
          updatedAt: serverTimestamp(),
          ...(followerExists ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });
      }
      
      // 6. Calculate correct follower and following counts
      if (targetUserDoc.exists()) {
        // Count active followers for target user
        const actualFollowerCount = await this.countActiveConnections(targetUserId, 'follower');
        const storedFollowerCount = targetUserDoc.data().followerCount || 0;
        
        // Always ensure counts are non-negative
        const correctedFollowerCount = Math.max(0, actualFollowerCount);
        
        if (correctedFollowerCount !== storedFollowerCount) {
          needsRepair = true;
          console.log(`Fixing follower count for ${targetUserId}: ${storedFollowerCount} → ${correctedFollowerCount}`);
          batch.update(targetUserRef, { followerCount: correctedFollowerCount });
        }
      }
      
      if (currentUserDoc.exists()) {
        // Count active following for current user
        const actualFollowingCount = await this.countActiveConnections(currentUserId, 'following');
        const storedFollowingCount = currentUserDoc.data().followingCount || 0;
        
        // Always ensure counts are non-negative
        const correctedFollowingCount = Math.max(0, actualFollowingCount);
        
        if (correctedFollowingCount !== storedFollowingCount) {
          needsRepair = true;
          console.log(`Fixing following count for ${currentUserId}: ${storedFollowingCount} → ${correctedFollowingCount}`);
          batch.update(currentUserRef, { followingCount: correctedFollowingCount });
        }
      }
      
      // 7. Execute the batch if there are any operations needed
      if (needsRepair) {
        await batch.commit();
        console.log('Follow relationship repaired successfully');
      } else {
        console.log('No repairs needed for follow relationship');
      }
      
      return true;
    } catch (error) {
      console.error('Error repairing follow relationship:', error);
      return false;
    }
  }
  
  /**
   * Count active connections of a specific type
   */
  static async countActiveConnections(
    userId: string,
    connectionType: 'follower' | 'following'
  ): Promise<number> {
    try {
      // Query the connections collection to count active connections
      // Updated to use new compound ID pattern
      const connectionsRef = collection(db, 'users', userId, 'connections');
      const q = query(
        connectionsRef,
        where('type', '==', connectionType),
        where('active', '==', true)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error counting connections:', error);
      return 0;
    }
  }
  
  /**
   * Restore correct follower count for a user based on actual connections
   */
  static async restoreFollowerCount(userId: string): Promise<number> {
    try {
      console.log(`Restoring follower count for user ${userId}`);
      
      // Get all active follower connections
      const connectionsRef = collection(db, 'users', userId, 'connections');
      const q = query(
        connectionsRef,
        where('type', '==', 'follower'),
        where('active', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const actualFollowerCount = snapshot.size;
      
      // Get the user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error(`User ${userId} not found`);
        return 0;
      }
      
      const currentCount = userDoc.data().followerCount || 0;
      
      // Ensure we never have negative follower counts
      const correctedCount = Math.max(0, actualFollowerCount);
      
      // Update the user document with the correct count
      if (currentCount !== correctedCount) {
        console.log(`Fixing follower count for ${userId}: ${currentCount} → ${correctedCount}`);
        await updateDoc(userRef, {
          followerCount: correctedCount
        });
      } else {
        console.log(`Follower count for ${userId} is already correct (${currentCount})`);
      }
      
      return correctedCount;
    } catch (error) {
      console.error('Error restoring follower count:', error);
      return 0;
    }
  }
  
  /**
   * Restore correct following count for a user based on actual connections
   */
  static async restoreFollowingCount(userId: string): Promise<number> {
    try {
      console.log(`Restoring following count for user ${userId}`);
      
      // Get all active following connections
      const connectionsRef = collection(db, 'users', userId, 'connections');
      const q = query(
        connectionsRef,
        where('type', '==', 'following'),
        where('active', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const actualFollowingCount = snapshot.size;
      
      // Get the user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error(`User ${userId} not found`);
        return 0;
      }
      
      const currentCount = userDoc.data().followingCount || 0;
      
      // Ensure we never have negative following counts
      const correctedCount = Math.max(0, actualFollowingCount);
      
      // Update the user document with the correct count
      if (currentCount !== correctedCount) {
        console.log(`Fixing following count for ${userId}: ${currentCount} → ${correctedCount}`);
        await updateDoc(userRef, {
          followingCount: correctedCount
        });
      } else {
        console.log(`Following count for ${userId} is already correct (${currentCount})`);
      }
      
      return correctedCount;
    } catch (error) {
      console.error('Error restoring following count:', error);
      return 0;
    }
  }
}
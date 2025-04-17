// src/lib/firebase/users.ts
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    limit,
    orderBy,
    updateDoc
  } from 'firebase/firestore';
  import { db } from './config';
  import { UserProfile } from '@/types/auth';
  
  /**
   * Get a user by their ID
   * @param userId User ID to fetch
   * @returns User profile or null if not found
   */
  export const getUserById = async (userId: string): Promise<UserProfile | null> => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return null;
      }
      
      return {
        uid: userSnap.id,
        ...userSnap.data()
      } as UserProfile;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  };
  
  /**
   * Search for users by display name
   * @param searchTerm Search term to match against display names
   * @param maxResults Maximum number of results to return
   * @returns Array of matching user profiles
   */
  export const searchUsers = async (
    searchTerm: string,
    maxResults: number = 10
  ): Promise<UserProfile[]> => {
    try {
      const searchLower = searchTerm.toLowerCase();
      
      // First try an efficient query using a displayNameLowercase field
      // This requires users to have a lowercase version of their display name stored
      // If your user documents are created differently, you might need to adjust this
      try {
        const usersRef = collection(db, 'users');
        
        // Get the boundaries for the range query
        const start = searchLower;
        const end = searchLower + '\uf8ff'; // High Unicode value to get all starting with searchLower
        
        const q = query(
          usersRef,
          where('displayNameLowercase', '>=', start),
          where('displayNameLowercase', '<=', end),
          limit(maxResults)
        );
        
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }) as UserProfile);
      } catch (indexError) {
        // If the first query fails (likely due to missing field or index),
        // fall back to a query on the displayName directly
        console.warn('Efficient user search failed, falling back to basic query:', indexError);
        
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          orderBy('displayName'),
          limit(100) // Get more users than needed for filtering
        );
        
        const querySnapshot = await getDocs(q);
        
        // Filter results client-side
        return querySnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data.displayName && 
                   data.displayName.toLowerCase().includes(searchLower);
          })
          .slice(0, maxResults)
          .map(doc => ({
            uid: doc.id,
            ...doc.data()
          }) as UserProfile);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      
      // Last resort fallback - get a limited number of users
      try {
        const usersRef = collection(db, 'users');
        const fallbackQuery = query(usersRef, limit(maxResults * 2));
        const snapshot = await getDocs(fallbackQuery);
        
        return snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }) as UserProfile);
      } catch (fallbackError) {
        console.error('Final fallback search failed:', fallbackError);
        return [];
      }
    }
  };
  
  /**
   * Get multiple users by their IDs
   * @param userIds Array of user IDs to fetch
   * @returns Object mapping user IDs to user profiles
   */
  export const getUsersByIds = async (
    userIds: string[]
  ): Promise<Record<string, UserProfile>> => {
    try {
      const uniqueIds = [...new Set(userIds)]; // Remove duplicates
      const result: Record<string, UserProfile> = {};
      
      // Fetch users in parallel
      const promises = uniqueIds.map(async (id) => {
        const user = await getUserById(id);
        if (user) {
          result[id] = user;
        }
      });
      
      await Promise.all(promises);
      
      return result;
    } catch (error) {
      console.error('Error fetching multiple users:', error);
      return {};
    }
  };
  
  /**
   * Update a user's profile information
   * @param userId User ID to update
   * @param profileData Updated profile data
   */
  export const updateUserProfile = async (
    userId: string,
    profileData: Partial<Omit<UserProfile, 'uid'>>
  ): Promise<void> => {
    try {
      // If updating the display name, also update lowercase version for search
      if (profileData.displayName) {
        profileData = {
          ...profileData,
          displayNameLowercase: profileData.displayName.toLowerCase()
        };
      }
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, profileData);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };
  
  /**
   * Get popular or recommended users to follow
   * @param limit Maximum number of users to return
   * @param excludeUserIds User IDs to exclude (e.g., current user and already followed users)
   * @returns Array of user profiles
   */
  export const getRecommendedUsers = async (
    limit: number = 5,
    excludeUserIds: string[] = []
  ): Promise<UserProfile[]> => {
    try {
      // In a real app, you would have a more sophisticated recommendation algorithm
      // This is a simple example that just returns recent users
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(Number(limit) + excludeUserIds.length) // Fetch extra to account for filtering
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter out excluded users
      return querySnapshot.docs
        .filter(doc => !excludeUserIds.includes(doc.id))
        .slice(0, limit)
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        }) as UserProfile);
    } catch (error) {
      console.error('Error getting recommended users:', error);
      return [];
    }
  };
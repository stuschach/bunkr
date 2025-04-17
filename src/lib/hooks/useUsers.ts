// src/lib/hooks/useUsers.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  doc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  query, 
  where, 
  collection, 
  limit, 
  orderBy,
  startAt,
  endAt,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheOperationPriority } from '@/lib/services/CacheService';

// Constants for cache management
const USER_CACHE_PREFIX = 'user_';
const BATCH_CACHE_PREFIX = 'users_batch_';
const SEARCH_CACHE_PREFIX = 'users_search_';
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Type for Firestore user data
interface FirestoreUserData {
  email?: string;
  displayName?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  createdAt?: {
    toDate: () => Date;
  };
  handicapIndex?: number;
  homeCourse?: string;
  profileComplete?: boolean;
  bio?: string;
  displayNameLowercase?: string;
  isAdmin?: boolean;
  [key: string]: any;
}

export function useUsers() {
  // In-memory cache for even faster access
  const memoryCache = useRef<Record<string, { data: UserProfile; timestamp: number }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Error | null>(null);
  
  // Clean up expired memory cache entries
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      const newCache: Record<string, { data: UserProfile; timestamp: number }> = {};
      
      Object.entries(memoryCache.current).forEach(([key, entry]) => {
        if (now - entry.timestamp < DEFAULT_CACHE_TTL) {
          newCache[key] = entry;
        }
      });
      
      memoryCache.current = newCache;
    }, 60000); // Clean up every minute
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Choose cache service based on operation priority
  const chooseCacheService = useCallback((priority: CacheOperationPriority) => {
    return cacheService;
  }, []);
  
  // Convert Firestore data to UserProfile (with proper type handling)
  const convertToUserProfile = useCallback((docId: string, data: FirestoreUserData): UserProfile => {
    return {
      uid: docId,
      email: data.email || null,
      displayName: data.displayName || null,
      photoURL: data.photoURL || null,
      coverPhotoURL: data.coverPhotoURL || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      handicapIndex: data.handicapIndex !== undefined ? data.handicapIndex : null,
      homeCourse: data.homeCourse || null,
      profileComplete: !!data.profileComplete,
      bio: data.bio || null,
      isAdmin: !!data.isAdmin
    };
  }, []);
  
  /**
   * Get a user by ID with efficient caching
   */
  const getUserById = useCallback(async (
    userId: string,
    options?: {
      forceRefresh?: boolean;
      priority?: CacheOperationPriority;
    }
  ): Promise<UserProfile | null> => {
    if (!userId) return null;
    
    const priority = options?.priority || CacheOperationPriority.NORMAL;
    const cacheKey = `${USER_CACHE_PREFIX}${userId}`;
    
    // Set loading state
    setLoading(prev => ({ ...prev, [userId]: true }));
    
    try {
      // Check memory cache first (fastest)
      const memoryCachedUser = memoryCache.current[cacheKey];
      if (memoryCachedUser && !options?.forceRefresh) {
        setLoading(prev => ({ ...prev, [userId]: false }));
        return memoryCachedUser.data;
      }
      
      // Then check persisted cache
      const selectedCacheService = chooseCacheService(priority);
      if (!options?.forceRefresh) {
        const cachedUser = await selectedCacheService.get<UserProfile>(cacheKey, priority);
        if (cachedUser) {
          // Update memory cache
          memoryCache.current[cacheKey] = { 
            data: cachedUser, 
            timestamp: Date.now() 
          };
          
          setLoading(prev => ({ ...prev, [userId]: false }));
          return cachedUser;
        }
      }
      
      // No cache hit, fetch from Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await firestoreGetDoc(userRef);
      
      if (!userSnap.exists()) {
        setLoading(prev => ({ ...prev, [userId]: false }));
        return null;
      }
      
      // Process user data with proper typing
      const userData = userSnap.data() as FirestoreUserData;
      const user = convertToUserProfile(userSnap.id, userData);
      
      // Update both caches
      memoryCache.current[cacheKey] = { 
        data: user, 
        timestamp: Date.now() 
      };
      
      await selectedCacheService.set(
        cacheKey,
        user,
        { ttl: DEFAULT_CACHE_TTL },
        priority
      );
      
      return user;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err);
      setError(err instanceof Error ? err : new Error(`Failed to fetch user ${userId}`));
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [userId]: false }));
    }
  }, [chooseCacheService, convertToUserProfile]);
  
  /**
   * Get multiple users by IDs efficiently (batch loading)
   */
  const getUsersByIds = useCallback(async (
    userIds: string[],
    options?: {
      forceRefresh?: boolean;
      priority?: CacheOperationPriority;
    }
  ): Promise<Record<string, UserProfile>> => {
    if (!userIds.length) return {};
    
    const priority = options?.priority || CacheOperationPriority.NORMAL;
    const uniqueIds = [...new Set(userIds)];
    const batchKey = `${BATCH_CACHE_PREFIX}${uniqueIds.sort().join('_')}`;
    
    try {
      // Try to get the whole batch from cache first
      const selectedCacheService = chooseCacheService(priority);
      if (!options?.forceRefresh) {
        const cachedBatch = await selectedCacheService.get<Record<string, UserProfile>>(
          batchKey,
          priority
        );
        
        if (cachedBatch && Object.keys(cachedBatch).length === uniqueIds.length) {
          // Update memory cache with individual users
          Object.entries(cachedBatch).forEach(([uid, userData]) => {
            memoryCache.current[`${USER_CACHE_PREFIX}${uid}`] = {
              data: userData,
              timestamp: Date.now()
            };
          });
          
          return cachedBatch;
        }
      }
      
      // Check which users we already have in memory cache
      const result: Record<string, UserProfile> = {};
      const idsToFetch: string[] = [];
      
      uniqueIds.forEach(uid => {
        const memoryCacheKey = `${USER_CACHE_PREFIX}${uid}`;
        const memoryCached = memoryCache.current[memoryCacheKey];
        
        if (memoryCached && !options?.forceRefresh) {
          result[uid] = memoryCached.data;
        } else {
          idsToFetch.push(uid);
        }
      });
      
      // If we have all users in memory cache, return early
      if (idsToFetch.length === 0) {
        return result;
      }
      
      // Check persisted cache for remaining IDs
      await Promise.all(
        idsToFetch.map(async (uid) => {
          const cacheKey = `${USER_CACHE_PREFIX}${uid}`;
          if (!options?.forceRefresh) {
            const cachedUser = await selectedCacheService.get<UserProfile>(
              cacheKey,
              priority
            );
            
            if (cachedUser) {
              result[uid] = cachedUser;
              memoryCache.current[cacheKey] = {
                data: cachedUser,
                timestamp: Date.now()
              };
              return;
            }
          }
        })
      );
      
      // Filter out IDs we got from cache
      const remainingIds = idsToFetch.filter(id => !result[id]);
      
      // If we have all users from cache now, return early
      if (remainingIds.length === 0) {
        return result;
      }
      
      // Fetch remaining users from Firestore in batches of 10 (Firestore limit)
      for (let i = 0; i < remainingIds.length; i += 10) {
        const batchIds = remainingIds.slice(i, i + 10);
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batchIds)
        );
        
        const snapshot = await firestoreGetDocs(usersQuery);
        
        snapshot.forEach(doc => {
          const userData = doc.data() as FirestoreUserData;
          const user = convertToUserProfile(doc.id, userData);
          
          result[doc.id] = user;
          
          // Update individual user cache
          const userCacheKey = `${USER_CACHE_PREFIX}${doc.id}`;
          memoryCache.current[userCacheKey] = {
            data: user,
            timestamp: Date.now()
          };
          
          selectedCacheService.set(
            userCacheKey,
            user,
            { ttl: DEFAULT_CACHE_TTL },
            priority
          ).catch(err => console.error(`Error caching user ${doc.id}:`, err));
        });
      }
      
      // Cache the batch result
      await selectedCacheService.set(
        batchKey,
        result,
        { ttl: DEFAULT_CACHE_TTL },
        priority
      );
      
      return result;
    } catch (err) {
      console.error('Error fetching users batch:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch users batch'));
      return {};
    }
  }, [chooseCacheService, convertToUserProfile]);
  
  /**
   * Search users by display name with improved error handling and fallback strategies
   */
  const searchUsers = useCallback(async (
    searchQuery: string,
    options?: {
      maxResults?: number;
      forceRefresh?: boolean;
      priority?: CacheOperationPriority;
    }
  ): Promise<UserProfile[]> => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const maxResults = options?.maxResults || 10;
    const priority = options?.priority || CacheOperationPriority.LOW;
    const searchTerm = searchQuery.toLowerCase().trim();
    const cacheKey = `${SEARCH_CACHE_PREFIX}${searchTerm}_${maxResults}`;
    
    // Set global loading state for this search
    const searchStateKey = `search_${searchTerm}`;
    setLoading(prev => ({ ...prev, [searchStateKey]: true }));
    
    try {
      // Check cache first
      const selectedCacheService = chooseCacheService(priority);
      if (!options?.forceRefresh) {
        const cachedResults = await selectedCacheService.get<UserProfile[]>(
          cacheKey,
          priority
        );
        
        if (cachedResults) {
          // Update memory cache with individual users
          cachedResults.forEach(user => {
            const userCacheKey = `${USER_CACHE_PREFIX}${user.uid}`;
            memoryCache.current[userCacheKey] = {
              data: user,
              timestamp: Date.now()
            };
          });
          
          setLoading(prev => ({ ...prev, [searchStateKey]: false }));
          return cachedResults;
        }
      }
      
      // Perform the search in Firestore using multiple strategies
      const results = await searchUsersWithFallbacks(searchTerm, maxResults);
      
      // Cache search results
      await selectedCacheService.set(
        cacheKey,
        results,
        { ttl: DEFAULT_CACHE_TTL },
        priority
      );
      
      return results;
    } catch (err) {
      console.error('Error searching users:', err);
      setError(err instanceof Error ? err : new Error('Failed to search users'));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, [searchStateKey]: false }));
    }
  }, [chooseCacheService, convertToUserProfile]);
  
  /**
   * Multi-strategy user search with fallbacks
   */
  const searchUsersWithFallbacks = async (searchTerm: string, maxResults: number): Promise<UserProfile[]> => {
    const strategies = [
      // Strategy 1: Search by displayNameLowercase with range query (requires index)
      async () => {
        try {
          const start = searchTerm;
          const end = searchTerm + '\uf8ff';
          
          const usersRef = collection(db, 'users');
          const searchQuery = query(
            usersRef,
            where('displayNameLowercase', '>=', start),
            where('displayNameLowercase', '<=', end),
            limit(maxResults)
          );
          
          const snapshot = await firestoreGetDocs(searchQuery);
          
          // Process results
          return snapshot.docs.map(doc => {
            const userData = doc.data() as FirestoreUserData;
            const user = convertToUserProfile(doc.id, userData);
            
            // Update memory cache
            const userCacheKey = `${USER_CACHE_PREFIX}${doc.id}`;
            memoryCache.current[userCacheKey] = {
              data: user,
              timestamp: Date.now()
            };
            
            return user;
          });
        } catch (error) {
          // Log but don't throw - let it try other strategies
          console.warn('Strategy 1 (displayNameLowercase) failed:', error);
          return null; // Signal to try next strategy
        }
      },
      
      // Strategy 2: Search by displayName with orderBy and startAt/endAt (requires different index)
      async () => {
        try {
          const usersRef = collection(db, 'users');
          const searchQuery = query(
            usersRef,
            orderBy('displayName'),
            startAt(searchTerm),
            endAt(searchTerm + '\uf8ff'),
            limit(maxResults)
          );
          
          const snapshot = await firestoreGetDocs(searchQuery);
          
          return snapshot.docs.map(doc => {
            const userData = doc.data() as FirestoreUserData;
            const user = convertToUserProfile(doc.id, userData);
            
            // Update memory cache
            const userCacheKey = `${USER_CACHE_PREFIX}${doc.id}`;
            memoryCache.current[userCacheKey] = {
              data: user,
              timestamp: Date.now()
            };
            
            return user;
          });
        } catch (error) {
          console.warn('Strategy 2 (displayName orderBy) failed:', error);
          return null; // Signal to try next strategy
        }
      },
      
      // Strategy 3: Fetch more users and filter client-side (fallback)
      async () => {
        const usersRef = collection(db, 'users');
        const fallbackQuery = query(
          usersRef,
          orderBy('displayName'),
          limit(100) // Get more to filter client-side
        );
        
        const snapshot = await firestoreGetDocs(fallbackQuery);
        
        // Filter in memory
        return snapshot.docs
          .filter(doc => {
            const data = doc.data() as FirestoreUserData;
            return data.displayName && 
                   data.displayName.toLowerCase().includes(searchTerm);
          })
          .slice(0, maxResults)
          .map(doc => {
            const userData = doc.data() as FirestoreUserData;
            const user = convertToUserProfile(doc.id, userData);
            
            // Update memory cache
            const userCacheKey = `${USER_CACHE_PREFIX}${doc.id}`;
            memoryCache.current[userCacheKey] = {
              data: user,
              timestamp: Date.now()
            };
            
            return user;
          });
      }
    ];
    
    // Try each strategy in order until one succeeds
    for (const strategy of strategies) {
      try {
        const results = await strategy();
        if (results !== null) {
          return results;
        }
      } catch (error) {
        // Log and continue to next strategy
        console.warn('Search strategy failed:', error);
      }
    }
    
    // If all strategies fail, return empty array
    return [];
  };
  
  /**
   * Clear user cache
   */
  const clearUserCache = useCallback(async (
    userId?: string,
    options?: {
      priority?: CacheOperationPriority;
    }
  ) => {
    const priority = options?.priority || CacheOperationPriority.HIGH;
    const selectedCacheService = chooseCacheService(priority);
    
    try {
      if (userId) {
        // Clear specific user
        const cacheKey = `${USER_CACHE_PREFIX}${userId}`;
        delete memoryCache.current[cacheKey];
        await selectedCacheService.remove(cacheKey, priority);
        
        // Also clear batch caches containing this user
        await selectedCacheService.removeByPrefix(`${BATCH_CACHE_PREFIX}`, priority);
      } else {
        // Clear all user caches
        memoryCache.current = {};
        await selectedCacheService.removeByPrefix(USER_CACHE_PREFIX, priority);
        await selectedCacheService.removeByPrefix(BATCH_CACHE_PREFIX, priority);
        await selectedCacheService.removeByPrefix(SEARCH_CACHE_PREFIX, priority);
      }
    } catch (err) {
      console.error('Error clearing user cache:', err);
    }
  }, [chooseCacheService]);

  return {
    getUserById,
    getUsersByIds,
    searchUsers,
    clearUserCache,
    loading,
    error,
  };
}
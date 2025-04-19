// src/lib/services/tee-times-service.ts
import { 
  addDoc, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp, 
  serverTimestamp,
  runTransaction,
  startAfter,
  setDoc,
  startAt,
  endAt,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  WhereFilterOp,
  FirestoreError,
  DocumentSnapshot,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { 
  TeeTime, 
  TeeTimeFormData, 
  TeeTimePlayer, 
  TeeTimeStatus, 
  PlayerStatus,
  TeeTimeFilters
} from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheOperationPriority } from '@/lib/services/CacheService';
import { jobQueue, JobPriority } from '@/lib/services/JobQueueService';
import { logger } from '@/lib/utils/logger';

// Constants
const TEE_TIMES_COLLECTION = 'teeTimes';
const TEE_TIME_PLAYERS_COLLECTION = 'players';
const USERS_COLLECTION = 'users';
const USER_TEE_TIMES_COLLECTION = 'teeTimes';
const POSTS_COLLECTION = 'posts';
const FEEDS_COLLECTION = 'feeds';
const MAX_BATCH_SIZE = 500;
const FIRESTORE_QUERY_LIMIT = 10; // Firestore "in" query limit

// Error classes for better error handling
export class TeeTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeeTimeError';
  }
}

export class TeeTimeNotFoundError extends TeeTimeError {
  constructor(teeTimeId: string) {
    super(`Tee time ${teeTimeId} not found`);
    this.name = 'TeeTimeNotFoundError';
  }
}

export class TeeTimeAccessError extends TeeTimeError {
  constructor(message: string) {
    super(message);
    this.name = 'TeeTimeAccessError';
  }
}

export class TeeTimeStatusError extends TeeTimeError {
  constructor(message: string) {
    super(message);
    this.name = 'TeeTimeStatusError';
  }
}

/**
 * Helper function to convert Firestore data to TeeTime
 */
const convertToTeeTime = (doc: any): TeeTime => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    creatorId: data.creatorId || '',
    courseName: data.courseName || '',
    courseId: data.courseId || null,
    dateTime: data.dateTime?.toDate() || null,
    maxPlayers: data.maxPlayers || 4,
    currentPlayers: data.currentPlayers || 1,
    status: data.status || 'open',
    visibility: data.visibility || 'public',
    description: data.description || '',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    players: data.players || []
  };
};

/**
 * Create a new tee time
 */
export const createTeeTime = async (
  userId: string, 
  teeTimeData: TeeTimeFormData
): Promise<string> => {
  try {
    // Combine date and time
    const dateTime = new Date(teeTimeData.date);
    const [hours, minutes] = teeTimeData.time.split(':').map(Number);
    dateTime.setHours(hours, minutes);
    
    // Validate input data
    if (!teeTimeData.courseName) {
      throw new TeeTimeError('Course name is required');
    }
    
    if (teeTimeData.maxPlayers < 1 || teeTimeData.maxPlayers > 8) {
      throw new TeeTimeError('Player count must be between 1 and 8');
    }
    
    if (dateTime < new Date()) {
      throw new TeeTimeError('Tee time date must be in the future');
    }
    
    // Use a job to ensure reliable execution
    const { resultPromise } = await jobQueue.enqueue<string>(async () => {
      // Use a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);
      
      // Create the tee time document
      const teeTimeRef = doc(collection(db, TEE_TIMES_COLLECTION));
      
      const teeTimeDocData = {
        creatorId: userId,
        courseName: teeTimeData.courseName,
        courseId: teeTimeData.courseId || null,
        dateTime: Timestamp.fromDate(dateTime),
        maxPlayers: teeTimeData.maxPlayers,
        currentPlayers: 1, // Creator is the first player
        status: 'open' as TeeTimeStatus,
        visibility: teeTimeData.visibility,
        description: teeTimeData.description || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(teeTimeRef, teeTimeDocData);
      
      // Add the creator as a confirmed player
      const playerDocRef = doc(collection(db, TEE_TIMES_COLLECTION, teeTimeRef.id, TEE_TIME_PLAYERS_COLLECTION), userId);
      
      batch.set(playerDocRef, {
        userId: userId,
        status: 'confirmed' as PlayerStatus,
        joinedAt: serverTimestamp(),
        isCreator: true,
        requestType: 'creator'
      });
      
      // Add reference to user's tee times
      const userTeeTimeRef = doc(collection(db, USERS_COLLECTION, userId, USER_TEE_TIMES_COLLECTION));
      
      batch.set(userTeeTimeRef, {
        teeTimeId: teeTimeRef.id,
        role: 'creator',
        status: 'confirmed' as PlayerStatus,
        createdAt: serverTimestamp(),
        userId: userId, // Added to match security rule requirement
        requestType: 'creator'
      });
      
      // ADDED: Create post directly (backup mechanism)
      const postRef = doc(collection(db, POSTS_COLLECTION));
      
      const postContent = `I'm hosting a tee time at ${teeTimeData.courseName} on ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Looking for ${teeTimeData.maxPlayers - 1} more players!`;
      
      const postData = {
        authorId: userId,
        content: postContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        postType: 'tee-time',
        teeTimeId: teeTimeRef.id,
        courseName: teeTimeData.courseName,
        courseId: teeTimeData.courseId || null,
        dateTime: Timestamp.fromDate(dateTime),
        maxPlayers: teeTimeData.maxPlayers,
        visibility: teeTimeData.visibility,
        likes: 0,
        comments: 0,
        likedBy: []
      };
      
      batch.set(postRef, postData);
      
      // ADDED: Create feed entry directly (backup mechanism)
      const feedRef = doc(collection(db, FEEDS_COLLECTION, userId, 'posts'), postRef.id);
      
      const feedData = {
        postId: postRef.id,
        authorId: userId,
        createdAt: serverTimestamp(),
        postType: 'tee-time',
        teeTimeId: teeTimeRef.id,
        courseName: teeTimeData.courseName,
        dateTime: Timestamp.fromDate(dateTime),
        maxPlayers: teeTimeData.maxPlayers,
        visibility: teeTimeData.visibility
      };
      
      batch.set(feedRef, feedData);
      
      // Execute all operations
      await batch.commit();
      
      // Clear cache entries that might include this tee time
      await cacheService.removeByPrefix('teeTimes', CacheOperationPriority.HIGH);
      
      logger.info(`Successfully created tee time ${teeTimeRef.id} with post ${postRef.id} and feed entry`);
      
      return teeTimeRef.id;
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 3,
        initialDelay: 500,
        backoffFactor: 2
      },
      timeout: 10000 // 10 seconds
    });
    
    return await resultPromise;
  } catch (error) {
    logger.error('Error creating tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to create tee time');
  }
};

/**
 * Get a single tee time by ID with caching support
 */
export const getTeeTimeById = async (teeTimeId: string): Promise<TeeTime | null> => {
  const cacheKey = CACHE_KEYS.TEE_TIME(teeTimeId);
  
  try {
    // Try to get from cache first
    return await cacheService.getFallback<TeeTime | null>(
      cacheKey,
      async () => {
        const teeTimeDoc = await getDoc(doc(db, TEE_TIMES_COLLECTION, teeTimeId));
        
        if (!teeTimeDoc.exists()) {
          return null;
        }
        
        return convertToTeeTime(teeTimeDoc);
      },
      CacheOperationPriority.HIGH
    );
  } catch (error) {
    logger.error('Error getting tee time:', error);
    return null;
  }
};

/**
 * Set up a real-time listener for a tee time
 */
export const subscribeTeeTime = (
  teeTimeId: string,
  callback: (teeTime: TeeTime | null) => void
): (() => void) => {
  const unsubscribe = onSnapshot(
    doc(db, TEE_TIMES_COLLECTION, teeTimeId),
    (doc) => {
      if (!doc.exists()) {
        callback(null);
        return;
      }
      
      const teeTime = convertToTeeTime(doc);
      
      // Update cache with best-effort approach (don't block the callback)
      cacheService.set(
        CACHE_KEYS.TEE_TIME(teeTimeId),
        teeTime,
        { ttl: CACHE_TTL.TEE_TIME },
        CacheOperationPriority.HIGH
      ).catch(e => logger.error('Error updating tee time cache:', e));
      
      callback(teeTime);
    },
    (error) => {
      logger.error(`Error in tee time listener for ${teeTimeId}:`, error);
      callback(null);
    }
  );
  
  return unsubscribe;
};

/**
 * Get tee time with players
 */
export const getTeeTimeWithPlayers = async (teeTimeId: string): Promise<{
  teeTime: TeeTime | null;
  players: TeeTimePlayer[];
}> => {
  try {
    // First try to get the complete data from cache
    const cacheKey = `${CACHE_KEYS.TEE_TIME(teeTimeId)}_with_players`;
    
    const cachedData = await cacheService.get<{
      teeTime: TeeTime;
      players: TeeTimePlayer[];
    }>(cacheKey, CacheOperationPriority.HIGH);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Not in cache, get from Firestore using a job for reliability
    const { resultPromise } = await jobQueue.enqueue<{
      teeTime: TeeTime | null;
      players: TeeTimePlayer[];
    }>(async () => {
      // Get tee time
      const teeTime = await getTeeTimeById(teeTimeId);
      
      if (!teeTime) {
        return { teeTime: null, players: [] };
      }
      
      // Get players from subcollection
      const playersSnapshot = await getDocs(collection(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION));
      
      const players: TeeTimePlayer[] = playersSnapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          userId: data.userId || '',
          status: data.status || 'pending',
          joinedAt: data.joinedAt?.toDate() || new Date(),
          invitedBy: data.invitedBy || undefined,
          requestType: data.requestType || undefined
        };
      });
      
      // Return result
      return { teeTime, players };
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 2,
        initialDelay: 300,
        backoffFactor: 2
      }
    });
    
    const result = await resultPromise;
    
    // Cache the result if we have data
    if (result.teeTime) {
      await cacheService.set(
        cacheKey,
        result,
        { ttl: CACHE_TTL.TEE_TIME },
        CacheOperationPriority.NORMAL
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Error getting tee time with players:', error);
    throw error;
  }
};

/**
 * Set up a real-time listener for tee time players
 */
export const subscribeTeeTimePlayers = (
  teeTimeId: string,
  callback: (players: TeeTimePlayer[]) => void
): (() => void) => {
  const unsubscribe = onSnapshot(
    collection(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION),
    (snapshot) => {
      const players: TeeTimePlayer[] = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          userId: data.userId || '',
          status: data.status || 'pending',
          joinedAt: data.joinedAt?.toDate() || new Date(),
          invitedBy: data.invitedBy || undefined,
          requestType: data.requestType || undefined
        };
      });
      
      // Update cache with best-effort approach (don't block the callback)
      const cacheKey = `${CACHE_KEYS.TEE_TIME(teeTimeId)}_players`;
      
      cacheService.set(
        cacheKey,
        players,
        { ttl: CACHE_TTL.TEE_TIME },
        CacheOperationPriority.NORMAL
      ).catch(e => logger.error('Error updating tee time players cache:', e));
      
      callback(players);
    },
    (error) => {
      logger.error(`Error in tee time players listener for ${teeTimeId}:`, error);
      callback([]);
    }
  );
  
  return unsubscribe;
};

/**
 * Get all public tee times with optional filters and pagination
 */
export const getTeeTimesList = async (
  filters?: TeeTimeFilters,
  lastVisible?: DocumentSnapshot,
  pageSize: number = 10
): Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }> => {
  try {
    // Generate cache key based on filters
    const filterKey = cacheService.getTeeTimeFiltersCacheKey(filters);
    const cacheKey = `${CACHE_KEYS.TEE_TIME_LIST(filterKey)}_${pageSize}_${lastVisible ? 'page' : 'first'}`;
    
    // Only try cache for the first page without lastVisible
    if (!lastVisible) {
      const cachedResult = await cacheService.get<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }>(
        cacheKey,
        CacheOperationPriority.HIGH
      );
      
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    // Use a job to ensure reliable execution
    const { resultPromise } = await jobQueue.enqueue<{ 
      teeTimes: TeeTime[]; 
      lastVisible: DocumentSnapshot | null 
    }>(async () => {
      // Base query constraints
      const constraints: any[] = [
        where('visibility', '==', 'public'),
        orderBy('dateTime', 'asc'),
      ];
      
      // Add status filter
      if (filters?.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      } else {
        // Exclude cancelled tee times by default
        constraints.push(where('status', '!=', 'cancelled'));
      }
      
      // Add date filter
      if (filters?.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        
        constraints.push(
          where('dateTime', '>=', Timestamp.fromDate(startOfDay)),
          where('dateTime', '<=', Timestamp.fromDate(endOfDay))
        );
      } else {
        // Only show future tee times by default
        constraints.push(where('dateTime', '>=', Timestamp.fromDate(new Date())));
      }
      
      // Add course filter
      if (filters?.courseId) {
        constraints.push(where('courseId', '==', filters.courseId));
      }
      
      // Apply pagination
      if (lastVisible) {
        constraints.push(startAfter(lastVisible));
      }
      
      // Apply limit
      constraints.push(limit(pageSize));
      
      // Execute query
      const teeTimesQuery = query(collection(db, TEE_TIMES_COLLECTION), ...constraints);
      const teeTimesSnapshot = await getDocs(teeTimesQuery);
      
      // Get the last visible document for pagination
      const lastVisibleDoc = teeTimesSnapshot.docs[teeTimesSnapshot.docs.length - 1] || null;
      
      // Convert documents to TeeTime objects
      const teeTimes = teeTimesSnapshot.docs.map(convertToTeeTime);
      
      return { teeTimes, lastVisible: lastVisibleDoc };
    }, {
      priority: JobPriority.NORMAL,
      retry: {
        maxRetries: 2,
        initialDelay: 300,
        backoffFactor: 2
      }
    });
    
    const result = await resultPromise;
    
    // Cache the result (only first page)
    if (!lastVisible) {
      await cacheService.set(
        cacheKey,
        result,
        { ttl: 5 * 60 * 1000 }, // 5 minutes
        CacheOperationPriority.NORMAL
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Error getting tee times list:', error);
    throw error;
  }
};

/**
 * Get tee times for a specific user with optional filtering
 * Improved to handle pagination and large datasets
 */
export const getUserTeeTimes = async (
  userId: string,
  status?: TeeTimeStatus,
  lastVisible?: DocumentSnapshot,
  pageSize: number = 20
): Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }> => {
  try {
    // Generate cache key for the first page
    const cacheKey = `user_${userId}_teeTimes${status ? `_${status}` : ''}${lastVisible ? '_page' : ''}`;
    
    // Only try cache for the first page without lastVisible
    if (!lastVisible) {
      const cachedResult = await cacheService.get<{ 
        teeTimes: TeeTime[]; 
        lastVisible: DocumentSnapshot | null 
      }>(cacheKey, CacheOperationPriority.HIGH);
      
      if (cachedResult) {
        return cachedResult;
      }
    }
    
    // Use a job for reliability
    const { resultPromise } = await jobQueue.enqueue<{ 
      teeTimes: TeeTime[]; 
      lastVisible: DocumentSnapshot | null 
    }>(async () => {
      // Build query with pagination support for the user tee times collection
      let userTeeTimesQuery = query(
        collection(db, USERS_COLLECTION, userId, USER_TEE_TIMES_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      if (lastVisible) {
        userTeeTimesQuery = query(userTeeTimesQuery, startAfter(lastVisible));
      }
      
      // Apply limit with a larger size to account for potential filtering
      userTeeTimesQuery = query(userTeeTimesQuery, limit(pageSize * 2));
      
      const userTeeTimesSnapshot = await getDocs(userTeeTimesQuery);
      
      if (userTeeTimesSnapshot.empty) {
        return { teeTimes: [], lastVisible: null };
      }
      
      // Extract tee time IDs
      const teeTimeIds = userTeeTimesSnapshot.docs
        .map(doc => (doc.data() || {}).teeTimeId as string)
        .filter(Boolean);
      
      if (teeTimeIds.length === 0) {
        return { teeTimes: [], lastVisible: null };
      }
      
      // Process IDs in chunks due to Firestore "in" query limitation
      const teeTimesChunks: TeeTime[] = [];
      
      // Use efficient chunks to fetch data
      for (let i = 0; i < teeTimeIds.length; i += FIRESTORE_QUERY_LIMIT) {
        const chunk = teeTimeIds.slice(i, i + FIRESTORE_QUERY_LIMIT);
        
        // Build query for this chunk
        let teeTimesQuery = query(
          collection(db, TEE_TIMES_COLLECTION),
          where('__name__', 'in', chunk)
        );
        
        const teeTimesSnapshot = await getDocs(teeTimesQuery);
        
        // Convert to TeeTime objects and filter if needed
        let timeTimesChunk = teeTimesSnapshot.docs.map(convertToTeeTime);
        
        // Apply status filter in memory if needed
        if (status) {
          timeTimesChunk = timeTimesChunk.filter(tt => tt.status === status);
        }
        
        teeTimesChunks.push(...timeTimesChunk);
      }
      
      // Sort by date (ascending)
      teeTimesChunks.sort((a, b) => {
        if (!a.dateTime || !b.dateTime) return 0;
        return a.dateTime.getTime() - b.dateTime.getTime();
      });
      
      // Apply pagination limiting
      const paginatedResults = teeTimesChunks.slice(0, pageSize);
      
      // Get last document for pagination
      const lastVisibleDoc = userTeeTimesSnapshot.docs.length >= pageSize * 2 
        ? userTeeTimesSnapshot.docs[userTeeTimesSnapshot.docs.length - 1] 
        : null;
      
      return { teeTimes: paginatedResults, lastVisible: lastVisibleDoc };
    }, {
      priority: JobPriority.NORMAL,
      retry: {
        maxRetries: 2,
        initialDelay: 300,
        backoffFactor: 2
      },
      timeout: 15000 // 15 seconds
    });
    
    const result = await resultPromise;
    
    // Cache the result for the first page
    if (!lastVisible) {
      await cacheService.set(
        cacheKey,
        result,
        { ttl: 5 * 60 * 1000 }, // 5 minutes TTL
        CacheOperationPriority.NORMAL
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Error getting user tee times:', error);
    throw error;
  }
};

/**
 * Update an existing tee time
 */
export const updateTeeTime = async (
  teeTimeId: string,
  userId: string,
  updates: Partial<TeeTimeFormData>
): Promise<void> => {
  try {
    // Use a job for reliability
    await jobQueue.enqueue<void>(async () => {
      // Get the tee time
      const teeTimeDoc = await getDoc(doc(db, TEE_TIMES_COLLECTION, teeTimeId));
      
      if (!teeTimeDoc.exists()) {
        throw new TeeTimeNotFoundError(teeTimeId);
      }
      
      // Verify user is the creator
      const teeTimeData = teeTimeDoc.data() || {};
      if (teeTimeData.creatorId !== userId) {
        throw new TeeTimeAccessError('Only the creator can update this tee time');
      }
      
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };
      
      // Update fields if they exist in the updates object
      if (updates.courseName) updateData.courseName = updates.courseName;
      if (updates.courseId !== undefined) updateData.courseId = updates.courseId;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.visibility) updateData.visibility = updates.visibility;
      
      // Handle date and time updates
      if (updates.date && updates.time) {
        const dateTime = new Date(updates.date);
        const [hours, minutes] = updates.time.split(':').map(Number);
        dateTime.setHours(hours, minutes);
        
        // Validate future date
        if (dateTime < new Date()) {
          throw new TeeTimeError('Tee time date must be in the future');
        }
        
        updateData.dateTime = Timestamp.fromDate(dateTime);
      }
      
      // Handle max players update with validation
      if (updates.maxPlayers && updates.maxPlayers !== teeTimeData.maxPlayers) {
        if (updates.maxPlayers < (teeTimeData.currentPlayers || 1)) {
          throw new TeeTimeError('Cannot reduce max players below current player count');
        }
        updateData.maxPlayers = updates.maxPlayers;
        
        // Update status if necessary
        if (teeTimeData.status === 'full' && updates.maxPlayers > (teeTimeData.currentPlayers || 1)) {
          updateData.status = 'open';
        }
      }
      
      // Update the document
      await updateDoc(doc(db, TEE_TIMES_COLLECTION, teeTimeId), updateData);
      
      // Cloud Function will handle updating the post automatically
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix('teeTimes', CacheOperationPriority.NORMAL);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 3,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `update_teeTime_${teeTimeId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error updating tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to update tee time');
  }
};

/**
 * Cancel a tee time
 */
export const cancelTeeTime = async (
  teeTimeId: string,
  userId: string
): Promise<void> => {
  try {
    // Use a job for reliability
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new TeeTimeNotFoundError(teeTimeId);
      }
      
      // Verify user is the creator
      const teeTimeData = teeTimeDoc.data() || {};
      if (teeTimeData.creatorId !== userId) {
        throw new TeeTimeAccessError('Only the creator can cancel this tee time');
      }
      
      // Update the tee time to cancelled
      await updateDoc(teeTimeRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      
      // Cloud Function will handle updating the post and sending notifications
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix('teeTimes', CacheOperationPriority.NORMAL);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 3,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `cancel_teeTime_${teeTimeId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error cancelling tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to cancel tee time');
  }
};

/**
 * Delete a tee time completely (not just cancel)
 */
export const deleteTeeTime = async (
  teeTimeId: string,
  userId: string
): Promise<TeeTimePlayer[]> => {
  try {
    // Use a job for reliability
    const { resultPromise } = await jobQueue.enqueue<TeeTimePlayer[]>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new TeeTimeNotFoundError(teeTimeId);
      }
      
      // Verify user is the creator
      const teeTimeData = teeTimeDoc.data() || {};
      if (teeTimeData.creatorId !== userId) {
        throw new TeeTimeAccessError('Only the creator can delete this tee time');
      }
      
      // Get all confirmed players for notifications
      const playersSnapshot = await getDocs(
        collection(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION)
      );
      
      const confirmedPlayers: TeeTimePlayer[] = playersSnapshot.docs
        .filter(doc => doc.data()?.status === 'confirmed' && doc.id !== userId)
        .map(doc => {
          const data = doc.data() || {};
          return {
            userId: doc.id,
            status: data.status || 'confirmed',
            joinedAt: data.joinedAt?.toDate() || new Date(),
            invitedBy: data.invitedBy || undefined,
            requestType: data.requestType || undefined
          };
        });
      
      // Delete all player documents
      const batch = writeBatch(db);
      
      // First delete all players in the subcollection
      playersSnapshot.docs.forEach(playerDoc => {
        batch.delete(playerDoc.ref);
      });
      
      // Delete the main tee time document
      batch.delete(teeTimeRef);
      
      // Commit the batch
      await batch.commit();
      
      // Cleanup user tee time references in a separate batch
      // This is done separately as it might exceed the batch size limit
      try {
        const userIds = playersSnapshot.docs.map(doc => doc.id);
        
        for (const userId of userIds) {
          const userTeeTimesQuery = query(
            collection(db, USERS_COLLECTION, userId, USER_TEE_TIMES_COLLECTION),
            where('teeTimeId', '==', teeTimeId)
          );
          
          const userTeeTimesSnapshot = await getDocs(userTeeTimesQuery);
          
          if (!userTeeTimesSnapshot.empty) {
            const cleanupBatch = writeBatch(db);
            
            userTeeTimesSnapshot.docs.forEach(doc => {
              cleanupBatch.delete(doc.ref);
            });
            
            await cleanupBatch.commit();
          }
        }
      } catch (error) {
        // Log but don't fail the entire operation if user references cleanup fails
        logger.error('Error cleaning up user tee time references:', error);
      }
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix('teeTimes', CacheOperationPriority.NORMAL);
      
      // Return confirmed players for notification
      return confirmedPlayers;
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 3,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `delete_teeTime_${teeTimeId}`,
      timeout: 10000 // 10 seconds
    });
    
    return await resultPromise;
  } catch (error) {
    logger.error('Error deleting tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to delete tee time');
  }
};

/**
 * Request to join a tee time - FIXED to always require approval
 */
export const requestToJoinTeeTime = async (
  teeTimeId: string,
  userId: string
): Promise<void> => {
  try {
    // Use a job for reliability and to prevent duplicate requests
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      // Use a transaction to ensure consistency
      await runTransaction(db, async (transaction) => {
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new TeeTimeNotFoundError(teeTimeId);
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Check if tee time is open
        if (teeTimeData.status !== 'open') {
          throw new TeeTimeStatusError(`Cannot join a ${teeTimeData.status} tee time`);
        }
        
        // Check if user is already in the tee time
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION, userId);
        const playerDoc = await transaction.get(playerRef);
        
        if (playerDoc.exists()) {
          throw new TeeTimeError('You are already part of this tee time');
        }
        
        // FIXED: Always set status to 'pending' regardless of visibility
        // Creator will always need to approve
        const playerStatus = 'pending';
        
        // Add player to tee time
        transaction.set(playerRef, {
          userId: userId,
          status: playerStatus,
          joinedAt: serverTimestamp(),
          requestType: 'join_request' // New field to distinguish request type
        });
        
        // Add to user tee times
        const userTeeTimeRef = doc(collection(db, USERS_COLLECTION, userId, USER_TEE_TIMES_COLLECTION));
        transaction.set(userTeeTimeRef, {
          teeTimeId: teeTimeId,
          role: 'player',
          status: playerStatus,
          createdAt: serverTimestamp(),
          userId: userId, // Added to match security rule requirement
          requestType: 'join_request'
        });
      });
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 2,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `join_teeTime_${teeTimeId}_${userId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error requesting to join tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to join tee time');
  }
};

/**
 * Approve a player's request to join a tee time
 */
export const approvePlayerRequest = async (
  teeTimeId: string,
  playerId: string,
  approverUserId: string
): Promise<void> => {
  try {
    // Use a job for reliability
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      await runTransaction(db, async (transaction) => {
        // Get the tee time
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new TeeTimeNotFoundError(teeTimeId);
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Verify approver is the creator
        if (teeTimeData.creatorId !== approverUserId) {
          throw new TeeTimeAccessError('Only the creator can approve requests');
        }
        
        // Check if tee time is full
        if ((teeTimeData.currentPlayers || 0) >= (teeTimeData.maxPlayers || 4)) {
          throw new TeeTimeStatusError('This tee time is already full');
        }
        
        // Get the player document
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION, playerId);
        const playerDoc = await transaction.get(playerRef);
        
        if (!playerDoc.exists() || (playerDoc.data() || {}).status !== 'pending') {
          throw new TeeTimeError('Player request not found');
        }
        
        // Update player status to confirmed
        transaction.update(playerRef, {
          status: 'confirmed',
          approvedAt: serverTimestamp(),
          approvedBy: approverUserId
        });
        
        // Update user-tee-time record
        const userTeeTimeQuery = query(
          collection(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION),
          where('teeTimeId', '==', teeTimeId)
        );
        
        const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
        
        if (!userTeeTimeSnapshot.empty) {
          const userTeeTimeDocRef = doc(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION, userTeeTimeSnapshot.docs[0].id);
          transaction.update(userTeeTimeDocRef, {
            status: 'confirmed',
            approvedAt: serverTimestamp(),
            approvedBy: approverUserId
          });
        }
        
        // Update tee time player count and status
        const newPlayerCount = (teeTimeData.currentPlayers || 0) + 1;
        const updateData: any = {
          currentPlayers: newPlayerCount,
          updatedAt: serverTimestamp(),
        };
        
        // If reaching max players, update status to full
        if (newPlayerCount >= (teeTimeData.maxPlayers || 4)) {
          updateData.status = 'full';
        }
        
        transaction.update(teeTimeRef, updateData);
      });
      
      // Cloud Function will handle notifications
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 2,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `approve_teeTime_${teeTimeId}_${playerId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error approving player request:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to approve player request');
  }
};

/**
 * Remove a player from a tee time
 */
export const removePlayerFromTeeTime = async (
  teeTimeId: string,
  playerId: string,
  removerUserId: string
): Promise<void> => {
  try {
    // Use a job for reliability
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      await runTransaction(db, async (transaction) => {
        // Get the tee time
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new TeeTimeNotFoundError(teeTimeId);
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Verify remover is the creator or the player themselves
        if (teeTimeData.creatorId !== removerUserId && playerId !== removerUserId) {
          throw new TeeTimeAccessError('You do not have permission to remove this player');
        }
        
        // Cannot remove the creator
        if (playerId === teeTimeData.creatorId) {
          throw new TeeTimeError('Cannot remove the creator from the tee time');
        }
        
        // Get the player document
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION, playerId);
        const playerDoc = await transaction.get(playerRef);
        
        if (!playerDoc.exists()) {
          throw new TeeTimeError('Player not found in this tee time');
        }
        
        const playerData = playerDoc.data() || {};
        
        // Only decrement player count if the player was confirmed
        let decrementPlayerCount = playerData.status === 'confirmed';
        
        // Update player record with status "removed"
        transaction.update(playerRef, {
          status: 'removed',
          removedAt: serverTimestamp(),
          removedBy: removerUserId
        });
        
        // Update user-tee-time record
        const userTeeTimeQuery = query(
          collection(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION),
          where('teeTimeId', '==', teeTimeId)
        );
        
        const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
        
        if (!userTeeTimeSnapshot.empty) {
          const userTeeTimeDocRef = doc(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION, userTeeTimeSnapshot.docs[0].id);
          transaction.update(userTeeTimeDocRef, {
            status: 'removed',
            removedAt: serverTimestamp(),
            removedBy: removerUserId,
            teeTimeId: teeTimeId // Added to match security rule requirement
          });
        }
        
        // Update tee time player count and status if needed
        if (decrementPlayerCount) {
          const newPlayerCount = Math.max((teeTimeData.currentPlayers || 1) - 1, 1);
          
          const updateData: any = {
            currentPlayers: newPlayerCount,
            updatedAt: serverTimestamp(),
          };
          
          // If it was full, update status back to open
          if (teeTimeData.status === 'full') {
            updateData.status = 'open';
          }
          
          transaction.update(teeTimeRef, updateData);
        }
      });
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 2,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `remove_teeTime_${teeTimeId}_${playerId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error removing player from tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to remove player');
  }
};

/**
 * Invite a player to a tee time - FIXED to clearly mark as invitation
 */
export const invitePlayerToTeeTime = async (
  teeTimeId: string,
  invitedUserId: string,
  inviterUserId: string
): Promise<void> => {
  try {
    // Use a job for reliability
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new TeeTimeNotFoundError(teeTimeId);
      }
      
      const teeTimeData = teeTimeDoc.data() || {};
      
      // Verify inviter is the creator
      if (teeTimeData.creatorId !== inviterUserId) {
        throw new TeeTimeAccessError('Only the creator can invite players');
      }
      
      // Check if tee time is full
      if (teeTimeData.status === 'full') {
        throw new TeeTimeStatusError('This tee time is already full');
      }
      
      // Get user profile to ensure they exist
      const userProfileRef = doc(db, USERS_COLLECTION, invitedUserId);
      const userProfileDoc = await getDoc(userProfileRef);
      
      if (!userProfileDoc.exists()) {
        throw new TeeTimeError('User not found');
      }
      
      // Check if user is already in the tee time
      const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION, invitedUserId);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        throw new TeeTimeError('This player is already part of the tee time');
      }
      
      // Use batch for consistency
      const batch = writeBatch(db);
      
      // FIXED: Add the player with pending status AND invitation flag
      batch.set(playerRef, {
        userId: invitedUserId,
        status: 'pending',
        joinedAt: serverTimestamp(),
        invitedBy: inviterUserId,
        requestType: 'invitation' // New field to distinguish request type
      });
      
      // Add to invited user's tee times
      const userTeeTimeRef = doc(collection(db, USERS_COLLECTION, invitedUserId, USER_TEE_TIMES_COLLECTION));
      
      batch.set(userTeeTimeRef, {
        teeTimeId: teeTimeId,
        role: 'player',
        status: 'pending',
        invitedBy: inviterUserId,
        createdAt: serverTimestamp(),
        userId: invitedUserId,  // Added to match security rule requirement
        requestType: 'invitation'
      });
      
      // Commit the batch
      await batch.commit();
      
      // Cloud Function will handle creating the notification
      
      // Invalidate cache
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
    }, {
      priority: JobPriority.HIGH,
      retry: {
        maxRetries: 2,
        initialDelay: 500,
        backoffFactor: 2
      },
      jobId: `invite_teeTime_${teeTimeId}_${invitedUserId}`,
      timeout: 10000 // 10 seconds
    });
  } catch (error) {
    logger.error('Error inviting player to tee time:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to invite player');
  }
};

/**
 * NEW FUNCTION: Allow invited player to respond to an invitation
 */
export const respondToInvitation = async (
  teeTimeId: string,
  playerId: string,
  response: 'accept' | 'decline'
): Promise<void> => {
  try {
    await jobQueue.enqueue<void>(async () => {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      await runTransaction(db, async (transaction) => {
        // Get the tee time
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new TeeTimeNotFoundError(teeTimeId);
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Get the player document
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, TEE_TIME_PLAYERS_COLLECTION, playerId);
        const playerDoc = await transaction.get(playerRef);
        
        if (!playerDoc.exists()) {
          throw new TeeTimeError('Player not found in this tee time');
        }
        
        const playerData = playerDoc.data() || {};
        
        // Verify this is an invitation
        if (playerData.requestType !== 'invitation' || playerData.status !== 'pending') {
          throw new TeeTimeError('No active invitation found');
        }
        
        // Verify player is responding to their own invitation
        if (playerData.userId !== playerId) {
          throw new TeeTimeAccessError('You can only respond to your own invitations');
        }
        
        if (response === 'accept') {
          // Update player status to confirmed
          transaction.update(playerRef, {
            status: 'confirmed',
            respondedAt: serverTimestamp()
          });
          
          // Update tee time player count and status
          const newPlayerCount = (teeTimeData.currentPlayers || 1) + 1;
          const updateData: any = {
            currentPlayers: newPlayerCount,
            updatedAt: serverTimestamp(),
          };
          
          // If reaching max players, update status to full
          if (newPlayerCount >= (teeTimeData.maxPlayers || 4)) {
            updateData.status = 'full';
          }
          
          transaction.update(teeTimeRef, updateData);
          
          // Update user-tee-time record
          const userTeeTimeQuery = query(
            collection(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION),
            where('teeTimeId', '==', teeTimeId)
          );
          
          const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
          
          if (!userTeeTimeSnapshot.empty) {
            const userTeeTimeDocRef = userTeeTimeSnapshot.docs[0].ref;
            transaction.update(userTeeTimeDocRef, {
              status: 'confirmed',
              respondedAt: serverTimestamp()
            });
          }
        } else {
          // Decline invitation
          transaction.update(playerRef, {
            status: 'declined',
            respondedAt: serverTimestamp()
          });
          
          // Update user-tee-time record
          const userTeeTimeQuery = query(
            collection(db, USERS_COLLECTION, playerId, USER_TEE_TIMES_COLLECTION),
            where('teeTimeId', '==', teeTimeId)
          );
          
          const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
          
          if (!userTeeTimeSnapshot.empty) {
            const userTeeTimeDocRef = userTeeTimeSnapshot.docs[0].ref;
            transaction.update(userTeeTimeDocRef, {
              status: 'declined',
              respondedAt: serverTimestamp()
            });
          }
        }
      });
      
      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
      await cacheService.removeByPrefix(`${CACHE_KEYS.TEE_TIME(teeTimeId)}_`, CacheOperationPriority.HIGH);
    }, {
      priority: JobPriority.HIGH,
      jobId: `respond_invite_${teeTimeId}_${playerId}`,
      timeout: 10000
    });
  } catch (error) {
    logger.error('Error responding to invitation:', error);
    
    if (error instanceof TeeTimeError) {
      throw error;
    }
    
    throw new TeeTimeError('Failed to respond to invitation');
  }
};

/**
 * Search users by name with improved caching and reliability
 */
/**
 * Set up a real-time listener for a user's tee times
 */
export const subscribeTeeTimesByUser = (
  userId: string,
  callback: (teeTimes: TeeTime[]) => void
): (() => void) => {
  // Create reference to user's tee times collection
  const userTeeTimesRef = collection(db, USERS_COLLECTION, userId, USER_TEE_TIMES_COLLECTION);
  
  // Set up the query
  const userTeeTimesQuery = query(
    userTeeTimesRef,
    orderBy('createdAt', 'desc')
  );
  
  // Set up the listener
  const unsubscribe = onSnapshot(
    userTeeTimesQuery,
    async (snapshot) => {
      try {
        // Extract tee time IDs
        const teeTimeIds = snapshot.docs
          .map(doc => (doc.data() || {}).teeTimeId as string)
          .filter(Boolean);
        
        if (teeTimeIds.length === 0) {
          callback([]);
          return;
        }
        
        // Process IDs in chunks due to Firestore "in" query limitation
        const teeTimesChunks: TeeTime[] = [];
        
        // Use efficient chunks to fetch data
        for (let i = 0; i < teeTimeIds.length; i += FIRESTORE_QUERY_LIMIT) {
          const chunk = teeTimeIds.slice(i, i + FIRESTORE_QUERY_LIMIT);
          
          // Build query for this chunk
          let teeTimesQuery = query(
            collection(db, TEE_TIMES_COLLECTION),
            where('__name__', 'in', chunk)
          );
          
          const teeTimesSnapshot = await getDocs(teeTimesQuery);
          
          // Convert to TeeTime objects
          const timeTimesChunk = teeTimesSnapshot.docs.map(convertToTeeTime);
          teeTimesChunks.push(...timeTimesChunk);
        }
        
        // Sort by date (ascending)
        teeTimesChunks.sort((a, b) => {
          if (!a.dateTime || !b.dateTime) return 0;
          return a.dateTime.getTime() - b.dateTime.getTime();
        });
        
        // Return the result
        callback(teeTimesChunks);
      } catch (error) {
        logger.error(`Error in tee times by user listener for ${userId}:`, error);
        callback([]);
      }
    },
    (error) => {
      logger.error(`Error in tee times by user listener for ${userId}:`, error);
      callback([]);
    }
  );
  
  return unsubscribe;
};

export const searchUsersByName = async (
  queryString: string,
  options: { maxResults?: number; cacheOnly?: boolean } = {}
): Promise<UserProfile[]> => {
  try {
    const { maxResults = 20, cacheOnly = false } = options;
    
    // Cache key for search results
    const cacheKey = `search_users_${queryString.toLowerCase().trim()}`;
    
    // Try to get from cache first
    const cachedResults = await cacheService.get<UserProfile[]>(cacheKey, CacheOperationPriority.HIGH);
    
    if (cachedResults) {
      return cachedResults.slice(0, maxResults);
    }
    
    // Return empty if cache-only mode
    if (cacheOnly) {
      return [];
    }
    
    // Use a job for reliability, but with lower priority
    const { resultPromise } = await jobQueue.enqueue<UserProfile[]>(async () => {
      // Firebase doesn't support true text search natively
      // We'll use a prefix search approach
      const cleanQuery = queryString.toLowerCase().trim();
      
      // Handle empty query
      if (!cleanQuery || cleanQuery.length < 2) {
        return [];
      }
      
      const usersRef = collection(db, USERS_COLLECTION);
      
      // We'll search by display name and displayNameLower
      const searchQueries = [
        // Search by displayName
        query(
          usersRef,
          orderBy('displayName'),
          startAt(cleanQuery),
          endAt(cleanQuery + '\uf8ff'),
          limit(maxResults)
        ),
        // Search by displayNameLower (if available)
        query(
          usersRef,
          orderBy('displayNameLower'),
          startAt(cleanQuery),
          endAt(cleanQuery + '\uf8ff'),
          limit(maxResults)
        )
      ];
      
      // Execute all queries and merge results
      const searchResults = await Promise.all(
        searchQueries.map(searchQuery => getDocs(searchQuery))
      );
      
      // Use a Set to deduplicate results by user ID
      const userIdSet = new Set<string>();
      const profileResults: UserProfile[] = [];
      
      // Process results from all queries
      for (const snapshot of searchResults) {
        for (const doc of snapshot.docs) {
          if (userIdSet.has(doc.id)) continue;
          
          userIdSet.add(doc.id);
          const data = doc.data() || {};
          
          profileResults.push({
            uid: doc.id,
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            email: data.email || null,
            createdAt: data.createdAt?.toDate() || new Date(),
            handicapIndex: data.handicapIndex || null,
            homeCourse: data.homeCourse || null,
            profileComplete: data.profileComplete || false,
            bio: data.bio || null,
            isAdmin: false
          });
          
          // Limit total results
          if (profileResults.length >= maxResults) break;
        }
        
        // Limit total results
        if (profileResults.length >= maxResults) break;
      }
      
      return profileResults;
    }, {
      priority: JobPriority.NORMAL,
      retry: {
        maxRetries: 1,
        initialDelay: 300,
        backoffFactor: 2
      },
      throttleKey: 'user_search',
      throttleLimit: 5  // Limit concurrent user searches
    });
    
    // Wait for results
    const results = await resultPromise;
    
    // Cache search results
    await cacheService.set(
      cacheKey,
      results,
      { ttl: 5 * 60 * 1000 }, // 5 minutes TTL
      CacheOperationPriority.LOW
    );
    
    return results;
  } catch (error) {
    logger.error('Error searching users:', error);
    return [];
  }
};
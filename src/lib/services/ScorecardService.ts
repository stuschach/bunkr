// src/lib/services/ScorecardService.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  writeBatch,
  DocumentSnapshot,
  DocumentReference,
  QueryDocumentSnapshot,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/services/CacheService';
import { HandicapService } from '@/lib/handicap/handicapService';
import { calculateCourseHandicap } from '@/lib/handicap/calculator';
import { fanoutPostToFeeds } from '@/lib/firebase/feed-service';
import { DenormalizedAuthorData } from '@/types/post';
import { Scorecard, HoleData, TeeBox } from '@/types/scorecard';
import { Course } from '@/types/course'; // Fixed import - was CourseData

/**
 * Error types for ScorecardService operations
 */
export enum ScorecardErrorType {
  NOT_FOUND = 'scorecard_not_found',
  UNAUTHORIZED = 'unauthorized',
  VALIDATION_ERROR = 'validation_error',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  ALREADY_EXISTS = 'already_exists',
  COURSE_NOT_FOUND = 'course_not_found',
}

/**
 * Custom error class for Scorecard operations
 */
export class ScorecardError extends Error {
  type: ScorecardErrorType;
  originalError?: Error;
  scorecardId?: string;

  constructor(
    message: string, 
    type: ScorecardErrorType, 
    originalError?: Error,
    scorecardId?: string
  ) {
    super(message);
    this.name = 'ScorecardError';
    this.type = type;
    this.originalError = originalError;
    this.scorecardId = scorecardId;
  }
}

/**
 * Filter options for fetching scorecards
 */
export interface ScorecardFilter {
  userId?: string;
  courseId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  lastVisible?: QueryDocumentSnapshot<any>;
  sortBy?: 'date' | 'totalScore' | 'courseName';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Options for creating and updating scorecards
 */
export interface ScorecardOptions {
  /** Whether to auto-share the round to the user's feed */
  autoShareToFeed?: boolean;
  /** Whether to update the user's handicap automatically */
  updateHandicap?: boolean;
  /** Whether to automatically calculate statistics */
  calculateStats?: boolean;
  /** Whether to save as a draft rather than a completed round */
  saveAsDraft?: boolean;
  /** Whether to create a copy instead of updating */
  createCopy?: boolean;
}

/**
 * Return type for scorecard lists with pagination info
 */
export interface ScorecardListResult {
  scorecards: Scorecard[];
  hasMore: boolean;
  lastVisible: QueryDocumentSnapshot<any> | null;
  total?: number;
}

/**
 * Main service class for Scorecard operations
 */
export class ScorecardService {
  /**
   * Fetch a single scorecard by ID
   */
  static async getScorecard(scorecardId: string, userId?: string): Promise<Scorecard> {
    try {
      // Try to get from cache first
      const cachedScorecard = await cacheService.get<Scorecard>(CACHE_KEYS.SCORECARD(scorecardId));
      if (cachedScorecard) {
        return cachedScorecard;
      }

      // Fetch from Firestore
      const scorecardRef = doc(db, 'scorecards', scorecardId);
      const scorecardSnap = await getDoc(scorecardRef);
      
      if (!scorecardSnap.exists()) {
        throw new ScorecardError(
          `Scorecard with ID ${scorecardId} not found`,
          ScorecardErrorType.NOT_FOUND,
          undefined,
          scorecardId
        );
      }
      
      const data = scorecardSnap.data() as Omit<Scorecard, 'id'>;
      
      // Check authorization if userId provided
      if (userId && data.userId !== userId && !data.isPublic) {
        throw new ScorecardError(
          'You do not have permission to view this scorecard',
          ScorecardErrorType.UNAUTHORIZED,
          undefined,
          scorecardId
        );
      }
      
      const scorecard: Scorecard = {
        id: scorecardId,
        ...data
      };
      
      // Cache the result
      await cacheService.set(
        CACHE_KEYS.SCORECARD(scorecardId), 
        scorecard, 
        { ttl: CACHE_TTL.SCORECARD }
      );
      
      return scorecard;
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to fetch scorecard: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error,
        scorecardId
      );
    }
  }

  /**
   * Fetch multiple scorecards with filtering and pagination
   */
  static async getScorecards(filter: ScorecardFilter): Promise<ScorecardListResult> {
    try {
      const {
        userId,
        courseId,
        startDate,
        endDate,
        limit: itemLimit = 10,
        lastVisible,
        sortBy = 'date',
        sortDirection = 'desc'
      } = filter;
      
      // Build the query
      let scorecardQuery = collection(db, 'scorecards');
      let constraints = [];
      
      // Add filters
      if (userId) {
        constraints.push(where('userId', '==', userId));
      }
      
      if (courseId) {
        constraints.push(where('courseId', '==', courseId));
      }
      
      if (startDate) {
        constraints.push(where('date', '>=', startDate));
      }
      
      if (endDate) {
        constraints.push(where('date', '<=', endDate));
      }
      
      // Add sorting
      constraints.push(orderBy(sortBy, sortDirection));
      
      // Add pagination
      constraints.push(limit(itemLimit));
      
      if (lastVisible) {
        constraints.push(startAfter(lastVisible));
      }
      
      // Create the final query
      const finalQuery = query(scorecardQuery, ...constraints);
      
      // Execute the query
      const querySnapshot = await getDocs(finalQuery);
      
      // Process results
      const scorecards: Scorecard[] = [];
      let newLastVisible: QueryDocumentSnapshot<any> | null = null;
      
      if (!querySnapshot.empty) {
        newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        querySnapshot.forEach(doc => {
          const data = doc.data() as Omit<Scorecard, 'id'>;
          const scorecard: Scorecard = {
            id: doc.id,
            ...data
          };
          scorecards.push(scorecard);
          
          // Cache individual scorecards
          cacheService.set(
            CACHE_KEYS.SCORECARD(doc.id), 
            scorecard, 
            { ttl: CACHE_TTL.SCORECARD }
          );
        });
      }
      
      return {
        scorecards,
        hasMore: querySnapshot.docs.length === itemLimit,
        lastVisible: newLastVisible
      };
    } catch (error) {
      throw new ScorecardError(
        `Failed to fetch scorecards: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error
      );
    }
  }

  /**
   * Create a new scorecard
   */
  static async createScorecard(
    data: Partial<Scorecard>, 
    userId: string,
    options: ScorecardOptions = {}
  ): Promise<Scorecard> {
    try {
      const {
        autoShareToFeed = false,
        updateHandicap = true,
        calculateStats = true,
        saveAsDraft = false
      } = options;
      
      // Validate required fields
      if (!data.courseId || !data.courseName) {
        throw new ScorecardError(
          'Course information is required',
          ScorecardErrorType.VALIDATION_ERROR
        );
      }
      
      if (!data.teeBox || !data.teeBox.name) {
        throw new ScorecardError(
          'Tee box information is required',
          ScorecardErrorType.VALIDATION_ERROR
        );
      }
      
      // Prepare holes if not provided or empty
      let holes = data.holes || [];
      if (holes.length === 0) {
        holes = await this.initializeHoles(data.courseId, data.coursePar || 72);
      } else if (holes.length < 18) {
        // Ensure we have 18 holes by filling with default values
        const defaultHoles = await this.initializeHoles(data.courseId, data.coursePar || 72);
        
        // Merge existing holes with defaults for missing ones
        holes = [...holes];
        for (let i = holes.length; i < 18; i++) {
          holes.push(defaultHoles[i]);
        }
      }
      
      // Calculate statistics if needed
      let stats = data.stats || {};
      if (calculateStats) {
        stats = this.calculateStats(holes);
      }
      
      // Generate new scorecard ID
      const scorecardRef = doc(collection(db, 'scorecards'));
      const scorecardId = scorecardRef.id;
      
      // Create basic scorecard data
      const scorecardData: Partial<Scorecard> = {
        id: scorecardId,
        userId,
        courseId: data.courseId,
        courseName: data.courseName,
        coursePar: data.coursePar || 72,
        date: data.date || new Date().toISOString().split('T')[0],
        totalScore: stats.totalScore || 0,
        scoreToPar: (stats.totalScore || 0) - (data.coursePar || 72),
        courseHandicap: data.courseHandicap || null,
        holes,
        teeBox: data.teeBox,
        stats,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        state: saveAsDraft ? 'draft' : 'completed',
        isCompleted: !saveAsDraft,
        ...data.notes ? { notes: data.notes } : {}
      };
      
      // Add timestamps
      const timestampData = {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(saveAsDraft ? {} : { finalizedAt: serverTimestamp() })
      };
      
      // Save to Firestore
      await setDoc(scorecardRef, {
        ...scorecardData,
        ...timestampData
      });
      
      // Create complete scorecard object with proper Date objects for client-side use
      const scorecard: Scorecard = {
        ...scorecardData,
        createdAt: new Date(),
        updatedAt: new Date(),
        finalizedAt: !saveAsDraft ? new Date() : undefined
      } as Scorecard;
      
      // Cache the result
      await cacheService.set(
        CACHE_KEYS.SCORECARD(scorecardId), 
        scorecard, 
        { ttl: CACHE_TTL.SCORECARD }
      );
      
      // Update user's handicap if needed
      if (updateHandicap && !saveAsDraft) {
        try {
          await HandicapService.updateHandicapAfterRound(userId, scorecardId);
        } catch (handicapError) {
          console.error('Error updating handicap:', handicapError);
          // Continue even if handicap update fails
        }
      }
      
      // Auto-share to feed if needed
      if (autoShareToFeed && !saveAsDraft) {
        try {
          await this.shareRoundToFeed(scorecard, userId);
        } catch (shareError) {
          console.error('Error sharing round to feed:', shareError);
          // Continue even if sharing fails
        }
      }
      
      return scorecard;
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to create scorecard: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error
      );
    }
  }

  /**
   * Update an existing scorecard
   */
  static async updateScorecard(
    scorecardId: string,
    data: Partial<Scorecard>,
    userId: string,
    options: ScorecardOptions = {}
  ): Promise<Scorecard> {
    try {
      const {
        autoShareToFeed = false,
        updateHandicap = true,
        calculateStats = true,
        saveAsDraft = false,
        createCopy = false
      } = options;
      
      // Get the existing scorecard
      const scorecardRef = doc(db, 'scorecards', scorecardId);
      const scorecardSnap = await getDoc(scorecardRef);
      
      if (!scorecardSnap.exists()) {
        throw new ScorecardError(
          `Scorecard with ID ${scorecardId} not found`,
          ScorecardErrorType.NOT_FOUND,
          undefined,
          scorecardId
        );
      }
      
      const existingData = scorecardSnap.data() as Omit<Scorecard, 'id'>;
      
      // Check authorization
      if (existingData.userId !== userId) {
        throw new ScorecardError(
          'You do not have permission to update this scorecard',
          ScorecardErrorType.UNAUTHORIZED,
          undefined,
          scorecardId
        );
      }
      
      // If creating a copy, use createScorecard instead
      if (createCopy) {
        const newData = {
          ...existingData,
          ...data,
          date: data.date || new Date().toISOString().split('T')[0]
        };
        delete (newData as any).id;
        return this.createScorecard(newData, userId, options);
      }
      
      // Prepare holes
      const holes = data.holes || existingData.holes;
      
      // Calculate statistics if needed
      let stats = data.stats || existingData.stats;
      if (calculateStats) {
        stats = this.calculateStats(holes);
      }
      
      // Update scorecard data
      const scorecardData: Partial<Scorecard> = {
        ...data,
        totalScore: stats.totalScore || 0,
        scoreToPar: (stats.totalScore || 0) - (data.coursePar || existingData.coursePar),
        stats,
        updatedAt: serverTimestamp(),
        state: saveAsDraft ? 'draft' : 'completed',
        isCompleted: !saveAsDraft
      };
      
      // Add finalizedAt if completing a draft
      if (existingData.state === 'draft' && !saveAsDraft) {
        (scorecardData as any).finalizedAt = serverTimestamp();
      }
      
      // Save to Firestore
      await updateDoc(scorecardRef, scorecardData);
      
      // Create complete scorecard object
      const scorecard: Scorecard = {
        id: scorecardId,
        ...existingData,
        ...scorecardData,
        updatedAt: new Date()
      };
      
      // Cache the result
      await cacheService.set(
        CACHE_KEYS.SCORECARD(scorecardId), 
        scorecard, 
        { ttl: CACHE_TTL.SCORECARD }
      );
      
      // Clear user scorecards cache
      await cacheService.remove(CACHE_KEYS.USER_SCORECARDS(userId));
      
      // Update user's handicap if needed
      if (updateHandicap && !saveAsDraft) {
        try {
          await HandicapService.updateHandicapAfterRound(userId, scorecardId);
        } catch (handicapError) {
          console.error('Error updating handicap:', handicapError);
          // Continue even if handicap update fails
        }
      }
      
      // Auto-share to feed if needed
      if (autoShareToFeed && !saveAsDraft && !existingData.isCompleted) {
        try {
          await this.shareRoundToFeed(scorecard, userId);
        } catch (shareError) {
          console.error('Error sharing round to feed:', shareError);
          // Continue even if sharing fails
        }
      }
      
      return scorecard;
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to update scorecard: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error,
        scorecardId
      );
    }
  }

  /**
   * Delete a scorecard
   */
  static async deleteScorecard(scorecardId: string, userId: string): Promise<void> {
    try {
      // Get the existing scorecard
      const scorecardRef = doc(db, 'scorecards', scorecardId);
      const scorecardSnap = await getDoc(scorecardRef);
      
      if (!scorecardSnap.exists()) {
        throw new ScorecardError(
          `Scorecard with ID ${scorecardId} not found`,
          ScorecardErrorType.NOT_FOUND,
          undefined,
          scorecardId
        );
      }
      
      const existingData = scorecardSnap.data();
      
      // Check authorization
      if (existingData.userId !== userId) {
        throw new ScorecardError(
          'You do not have permission to delete this scorecard',
          ScorecardErrorType.UNAUTHORIZED,
          undefined,
          scorecardId
        );
      }
      
      // Delete from Firestore
      await deleteDoc(scorecardRef);
      
      // Remove from cache
      await cacheService.remove(CACHE_KEYS.SCORECARD(scorecardId));
      await cacheService.remove(CACHE_KEYS.USER_SCORECARDS(userId));
      
      // When we delete a scorecard, we should also recalculate the handicap
      // This would ideally be handled by a Cloud Function trigger
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          // Flag the user for handicap recalculation
          await updateDoc(userRef, {
            handicapNeedsUpdate: true,
            handicapLastUpdateTrigger: serverTimestamp()
          });
        }
      } catch (handicapError) {
        console.error('Error flagging user for handicap update:', handicapError);
      }
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to delete scorecard: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error,
        scorecardId
      );
    }
  }

  /**
   * Update a specific hole in a scorecard
   */
  static async updateHoleData(
    scorecardId: string,
    holeNumber: number,
    holeData: Partial<HoleData>,
    userId: string,
    calculateStats: boolean = true
  ): Promise<Scorecard> {
    try {
      // Get the existing scorecard
      const scorecardRef = doc(db, 'scorecards', scorecardId);
      const scorecardSnap = await getDoc(scorecardRef);
      
      if (!scorecardSnap.exists()) {
        throw new ScorecardError(
          `Scorecard with ID ${scorecardId} not found`,
          ScorecardErrorType.NOT_FOUND,
          undefined,
          scorecardId
        );
      }
      
      const existingData = scorecardSnap.data() as Omit<Scorecard, 'id'>;
      
      // Check authorization
      if (existingData.userId !== userId) {
        throw new ScorecardError(
          'You do not have permission to update this scorecard',
          ScorecardErrorType.UNAUTHORIZED,
          undefined,
          scorecardId
        );
      }
      
      // Validate hole number
      if (holeNumber < 1 || holeNumber > 18) {
        throw new ScorecardError(
          `Invalid hole number: ${holeNumber}`,
          ScorecardErrorType.VALIDATION_ERROR
        );
      }
      
      // Update the hole
      const updatedHoles = [...existingData.holes];
      const holeIndex = holeNumber - 1;
      
      // Create the hole if it doesn't exist
      if (!updatedHoles[holeIndex]) {
        updatedHoles[holeIndex] = {
          number: holeNumber,
          par: 4, // Default par
          score: 0,
          fairwayHit: null,
          greenInRegulation: false,
          putts: 0,
          penalties: 0
        };
      }
      
      updatedHoles[holeIndex] = {
        ...updatedHoles[holeIndex],
        ...holeData
      };
      
      // Calculate new statistics if needed
      let stats = existingData.stats;
      if (calculateStats) {
        stats = this.calculateStats(updatedHoles);
      }
      
      // Create update data
      const updateData = {
        holes: updatedHoles,
        stats,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - existingData.coursePar,
        updatedAt: serverTimestamp()
      };
      
      // Save to Firestore
      await updateDoc(scorecardRef, updateData);
      
      // Create updated scorecard object
      const scorecard: Scorecard = {
        id: scorecardId,
        ...existingData,
        ...updateData,
        updatedAt: new Date(),
        holes: updatedHoles,
        totalScore: stats.totalScore || 0 // Ensure totalScore is a number
      };
      
      // Update cache
      await cacheService.set(
        CACHE_KEYS.SCORECARD(scorecardId), 
        scorecard, 
        { ttl: CACHE_TTL.SCORECARD }
      );
      
      return scorecard;
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to update hole data: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error,
        scorecardId
      );
    }
  }

  /**
   * Complete a scorecard (finish a round)
   */
  static async completeScorecard(
    scorecardId: string,
    userId: string,
    options: {
      shareToFeed?: boolean;
      updateHandicap?: boolean;
      message?: string;
    } = {}
  ): Promise<Scorecard> {
    try {
      const {
        shareToFeed = true,
        updateHandicap = true,
        message
      } = options;
      
      // Get the existing scorecard
      const scorecard = await this.getScorecard(scorecardId);
      
      // Check authorization
      if (scorecard.userId !== userId) {
        throw new ScorecardError(
          'You do not have permission to complete this scorecard',
          ScorecardErrorType.UNAUTHORIZED,
          undefined,
          scorecardId
        );
      }
      
      // Check if already completed
      if (scorecard.isCompleted) {
        // If already completed, just return it
        return scorecard;
      }
      
      // Batch update for performance and atomicity
      const batch = writeBatch(db);
      const scorecardRef = doc(db, 'scorecards', scorecardId);
      
      // Calculate final stats
      const finalStats = this.calculateStats(scorecard.holes);
      
      // Update data
      const updateData = {
        state: 'completed',
        isCompleted: true,
        stats: finalStats,
        totalScore: finalStats.totalScore,
        scoreToPar: finalStats.totalScore - scorecard.coursePar,
        finalizedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Update scorecard
      batch.update(scorecardRef, updateData);
      
      // Commit the batch
      await batch.commit();
      
      // Update the scorecard object
      // Use literal type directly instead of importing
      
      const updatedScorecard: Scorecard = {
        ...scorecard,
        ...updateData,
        updatedAt: new Date(),
        finalizedAt: new Date(),
        state: 'completed' as 'draft' | 'live' | 'completed' | 'archived' // Use literal union instead of ScorecardState
      };
      
      // Update cache
      await cacheService.set(
        CACHE_KEYS.SCORECARD(scorecardId), 
        updatedScorecard, 
        { ttl: CACHE_TTL.SCORECARD }
      );
      
      // Share to feed if requested
      if (shareToFeed) {
        try {
          await this.shareRoundToFeed(updatedScorecard, userId, message);
        } catch (shareError) {
          console.error('Error sharing round to feed:', shareError);
          // Continue even if sharing fails
        }
      }
      
      // Update handicap if requested
      if (updateHandicap) {
        try {
          await HandicapService.updateHandicapAfterRound(userId, scorecardId);
        } catch (handicapError) {
          console.error('Error updating handicap:', handicapError);
          // Continue even if handicap update fails
        }
      }
      
      return updatedScorecard;
    } catch (error) {
      if (error instanceof ScorecardError) {
        throw error;
      }
      
      throw new ScorecardError(
        `Failed to complete scorecard: ${(error as Error).message}`,
        ScorecardErrorType.SERVER_ERROR,
        error as Error,
        scorecardId
      );
    }
  }

  /**
   * Get course handicap for a user at a specific course and tee box
   */
  static async getCourseHandicap(
    userId: string,
    courseId: string,
    teeBox: TeeBox
  ): Promise<number | null> {
    try {
      // Get user's handicap index
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return null;
      }
      
      const userData = userSnap.data();
      const handicapIndex = userData.handicapIndex;
      
      if (handicapIndex === undefined || handicapIndex === null) {
        return null;
      }
      
      // Get course par
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      
      if (!courseSnap.exists()) {
        return null;
      }
      
      const courseData = courseSnap.data();
      const coursePar = courseData.par || 72;
      
      // Calculate course handicap
      return calculateCourseHandicap(
        handicapIndex,
        teeBox.slope,
        teeBox.rating,
        coursePar
      );
    } catch (error) {
      console.error('Error calculating course handicap:', error);
      return null;
    }
  }

  /**
   * Share a completed round to the user's feed
   */
  private static async shareRoundToFeed(
    scorecard: Scorecard, 
    userId: string,
    customMessage?: string
  ): Promise<string> {
    // Generate default message if not provided
    const scoreToParText = scorecard.scoreToPar === 0 
      ? 'even par' 
      : (scorecard.scoreToPar > 0 ? '+' : '') + scorecard.scoreToPar.toString();
    
    const message = customMessage || 
      `Just finished a round at ${scorecard.courseName} with a score of ${scorecard.totalScore} (${scoreToParText})!`;
    
    // Create post data
    const postData = {
      authorId: userId,
      content: message,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      postType: 'round',
      roundId: scorecard.id,
      
      // Include scorecard data
      courseName: scorecard.courseName,
      coursePar: scorecard.coursePar,
      totalScore: scorecard.totalScore,
      scoreToPar: scorecard.scoreToPar,
      date: scorecard.date,
      
      location: {
        name: scorecard.courseName,
        id: scorecard.courseId
      },
      visibility: scorecard.isPublic ? 'public' : 'private',
      likes: 0,
      comments: 0,
      hashtags: ['golf', 'scorecard'],
      media: []
    };
    
    // Add to posts collection
    const postRef = await addDoc(collection(db, 'posts'), postData);
    
    // Get user data for the feed
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    
    // Create denormalized author data
    const authorData: DenormalizedAuthorData = {
      uid: userId,
      displayName: userData.displayName || '',
      photoURL: userData.photoURL || '',
      handicapIndex: userData.handicapIndex !== undefined ? userData.handicapIndex : null
    };
    
    // Fan out to followers
    await fanoutPostToFeeds(postRef.id, userId, authorData, 'round');
    
    return postRef.id;
  }

  /**
   * Calculate statistics based on hole data
   */
  static calculateStats(holes: HoleData[]): any {
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
   * Initialize empty holes for a new scorecard
   */
  static async initializeHoles(courseId: string, defaultPar: number = 72): Promise<HoleData[]> {
    try {
      // Initialize empty holes with default pars
      const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 4, // Default par
        score: 0,
        fairwayHit: null,
        greenInRegulation: false,
        putts: 0,
        penalties: 0
      }));
      
      // Try to get hole data from the course
      if (courseId) {
        const holesRef = collection(db, 'courses', courseId, 'holes');
        const holesSnapshot = await getDocs(holesRef);
        
        if (!holesSnapshot.empty) {
          // Update holes with course data
          holesSnapshot.docs.forEach(doc => {
            const holeNumber = parseInt(doc.id);
            if (holeNumber >= 1 && holeNumber <= 18) {
              const holeIndex = holeNumber - 1;
              const data = doc.data();
              
              holes[holeIndex] = {
                ...holes[holeIndex],
                par: data.par || 4
              };
            }
          });
        } else {
          // If no hole data, distribute par evenly
          // For a standard course setup:
          // 4 par 3s (holes 2, 7, 11, 16)
          // 4 par 5s (holes 4, 9, 13, 18)
          // Rest are par 4s
          const par3Holes = [2, 7, 11, 16];
          const par5Holes = [4, 9, 13, 18];
          
          holes.forEach((hole, index) => {
            const holeNumber = index + 1;
            if (par3Holes.includes(holeNumber)) {
              holes[index].par = 3;
            } else if (par5Holes.includes(holeNumber)) {
              holes[index].par = 5;
            } else {
              holes[index].par = 4;
            }
          });
          
          // Adjust to match total par if needed
          const calculatedPar = holes.reduce((sum, hole) => sum + hole.par, 0);
          const diff = defaultPar - calculatedPar;
          
          if (diff !== 0) {
            if (diff > 0) {
              // Need to increase some pars
              for (let i = 0; i < diff && i < holes.length; i++) {
                // Find a par 4 that isn't already a par 5
                const hole = holes.find(h => h.par === 4 && !par5Holes.includes(h.number));
                if (hole) {
                  hole.par = 5;
                }
              }
            } else if (diff < 0) {
              // Need to decrease some pars
              for (let i = 0; i < Math.abs(diff) && i < holes.length; i++) {
                // Find a par 4 that isn't already a par 3
                const hole = holes.find(h => h.par === 4 && !par3Holes.includes(h.number));
                if (hole) {
                  hole.par = 3;
                }
              }
            }
          }
        }
      }
      
      return holes;
    } catch (error) {
      console.error('Error initializing holes:', error);
      
      // Return default holes if there's an error
      return Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: 4,
        score: 0,
        fairwayHit: null,
        greenInRegulation: false,
        putts: 0,
        penalties: 0
      }));
    }
  }
  
  /**
   * Generate a new cache key for user scorecards
   * This helps with cache invalidation when scorecards are updated
   */
  static CACHE_KEYS = {
    SCORECARD: (id: string) => `scorecard_${id}`,
    USER_SCORECARDS: (userId: string) => `user_scorecards_${userId}`,
  };
}

/**
 * For Firestore triggers - calculates and updates statistics whenever a scorecard is updated
 * This would be used in a Cloud Function
 */
export async function recalculateScorecardStats(
  scorecardId: string, 
  scorecardData: any
): Promise<void> {
  try {
    const holes = scorecardData.holes || [];
    if (holes.length === 0) return;
    
    // Calculate statistics
    const stats = ScorecardService.calculateStats(holes);
    
    // Update the scorecard
    const scorecardRef = doc(db, 'scorecards', scorecardId);
    await updateDoc(scorecardRef, {
      stats,
      totalScore: stats.totalScore,
      scoreToPar: stats.totalScore - (scorecardData.coursePar || 72),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error recalculating scorecard stats:', error);
  }
}
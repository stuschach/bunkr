// src/lib/services/CourseService.ts
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
    QueryDocumentSnapshot 
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase/config';
  import { cacheService, CACHE_KEYS, CACHE_TTL, CacheOperationPriority } from '@/lib/services/CacheService';
  import { Course, TeeBox, HoleData } from '@/types/course';
  
  /**
   * Error types for CourseService operations
   */
  export enum CourseErrorType {
    NOT_FOUND = 'course_not_found',
    SERVER_ERROR = 'server_error',
    NETWORK_ERROR = 'network_error',
  }
  
  /**
   * Custom error class for Course operations
   */
  export class CourseError extends Error {
    type: CourseErrorType;
    originalError?: Error;
    courseId?: string;
  
    constructor(
      message: string, 
      type: CourseErrorType, 
      originalError?: Error,
      courseId?: string
    ) {
      super(message);
      this.name = 'CourseError';
      this.type = type;
      this.originalError = originalError;
      this.courseId = courseId;
    }
  }
  
  /**
   * Filter options for fetching courses
   */
  export interface CourseFilter {
    name?: string;
    location?: string;
    userId?: string;
    limit?: number;
    lastVisible?: QueryDocumentSnapshot<any>;
    sortBy?: 'name' | 'location' | 'createdAt';
    sortDirection?: 'asc' | 'desc';
  }
  
  /**
   * Return type for course lists with pagination info
   */
  export interface CourseListResult {
    courses: Course[];
    hasMore: boolean;
    lastVisible: QueryDocumentSnapshot<any> | null;
    total?: number;
  }
  
  /**
   * Main service class for Course operations
   */
  export class CourseService {
    /**
     * Fetch a single course by ID
     */
    static async getCourse(courseId: string): Promise<Course> {
      try {
        // Try to get from cache first with HIGH priority
        const cachedCourse = await cacheService.get<Course>(
          CACHE_KEYS.COURSE(courseId),
          CacheOperationPriority.HIGH
        );
        
        if (cachedCourse) {
          return cachedCourse;
        }
  
        // Fetch from Firestore
        const courseRef = doc(db, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        
        if (!courseSnap.exists()) {
          throw new CourseError(
            `Course with ID ${courseId} not found`,
            CourseErrorType.NOT_FOUND,
            undefined,
            courseId
          );
        }
        
        const data = courseSnap.data() as Omit<Course, 'id'>;
        
        const course: Course = {
          id: courseId,
          ...data,
          teeBoxes: [], // Will be populated separately
          holes: []     // Will be populated separately
        };
        
        // Cache the course data
        await cacheService.set(
          CACHE_KEYS.COURSE(courseId),
          course,
          { ttl: CACHE_TTL.COURSE },
          CacheOperationPriority.HIGH
        );
        
        return course;
      } catch (error) {
        if (error instanceof CourseError) {
          throw error;
        }
        
        throw new CourseError(
          `Failed to fetch course: ${(error as Error).message}`,
          CourseErrorType.SERVER_ERROR,
          error as Error,
          courseId
        );
      }
    }
  
    /**
     * Get all tee boxes for a course
     */
    static async getCourseTeeBoxes(courseId: string): Promise<TeeBox[]> {
      try {
        // Try to get from cache first with HIGH priority
        const cacheKey = `course_teeboxes_${courseId}`;
        const cachedTeeBoxes = await cacheService.get<TeeBox[]>(
          cacheKey,
          CacheOperationPriority.HIGH
        );
        
        if (cachedTeeBoxes) {
          return cachedTeeBoxes;
        }
  
        // Fetch from Firestore
        const teeBoxesRef = collection(db, 'courses', courseId, 'teeBoxes');
        const teeBoxesSnapshot = await getDocs(teeBoxesRef);
        
        const teeBoxes: TeeBox[] = [];
        
        teeBoxesSnapshot.forEach(doc => {
          const data = doc.data();
          teeBoxes.push({
            id: doc.id,
            name: data.name || 'Unknown',
            color: data.color || '',
            rating: data.rating || 72.0,
            slope: data.slope || 113,
            yardage: data.yardage || 6200
          });
        });
        
        // Cache the tee boxes with HIGH priority
        await cacheService.set(
          cacheKey,
          teeBoxes,
          { ttl: CACHE_TTL.COURSE },
          CacheOperationPriority.HIGH
        );
        
        return teeBoxes;
      } catch (error) {
        throw new CourseError(
          `Failed to fetch tee boxes: ${(error as Error).message}`,
          CourseErrorType.SERVER_ERROR,
          error as Error,
          courseId
        );
      }
    }
  
    /**
     * Get all hole data for a course
     */
    static async getCourseHoles(courseId: string): Promise<HoleData[]> {
      try {
        // Try to get from cache first with CRITICAL priority
        const cacheKey = `course_holes_${courseId}`;
        const cachedHoles = await cacheService.get<HoleData[]>(
          cacheKey,
          CacheOperationPriority.CRITICAL
        );
        
        if (cachedHoles) {
          return cachedHoles;
        }
  
        // Initialize empty holes with default pars
        const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => ({
          number: i + 1,
          par: 4, // Default par
          distance: 350,
          handicapIndex: i + 1
        }));
        
        // Fetch from Firestore
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
                par: data.par || 4,
                distance: data.distance || 350,
                handicapIndex: data.handicapIndex || holeIndex + 1
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
        }
        
        // Cache the hole data with CRITICAL priority
        await cacheService.set(
          cacheKey,
          holes,
          { ttl: CACHE_TTL.COURSE },
          CacheOperationPriority.CRITICAL
        );
        
        return holes;
      } catch (error) {
        throw new CourseError(
          `Failed to fetch course holes: ${(error as Error).message}`,
          CourseErrorType.SERVER_ERROR,
          error as Error,
          courseId
        );
      }
    }
  
    /**
     * Get complete course data with tee boxes and holes
     */
    static async getCompleteCourse(courseId: string): Promise<Course> {
      try {
        // Try to get from cache first
        const cacheKey = `complete_course_${courseId}`;
        const cachedCompleteCourse = await cacheService.get<Course>(
          cacheKey,
          CacheOperationPriority.HIGH
        );
        
        if (cachedCompleteCourse) {
          return cachedCompleteCourse;
        }
  
        // Get basic course data
        const course = await this.getCourse(courseId);
        
        // Get tee boxes and holes in parallel
        const [teeBoxes, holes] = await Promise.all([
          this.getCourseTeeBoxes(courseId),
          this.getCourseHoles(courseId)
        ]);
        
        // Combine data
        const completeCourse: Course = {
          ...course,
          teeBoxes,
          holes
        };
        
        // Cache the complete course data
        await cacheService.set(
          cacheKey,
          completeCourse,
          { ttl: CACHE_TTL.COURSE },
          CacheOperationPriority.NORMAL
        );
        
        return completeCourse;
      } catch (error) {
        if (error instanceof CourseError) {
          throw error;
        }
        
        throw new CourseError(
          `Failed to fetch complete course: ${(error as Error).message}`,
          CourseErrorType.SERVER_ERROR,
          error as Error,
          courseId
        );
      }
    }
  
    /**
     * Search for courses with filtering and pagination
     */
    static async searchCourses(filter: CourseFilter): Promise<CourseListResult> {
      try {
        const {
          name,
          location,
          userId,
          limit: itemLimit = 10,
          lastVisible,
          sortBy = 'name',
          sortDirection = 'asc'
        } = filter;
        
        // Try to get from cache if this is a simple search
        if (name && !location && !userId && !lastVisible) {
          const cacheKey = `course_search_${name}_${itemLimit}`;
          const cachedResults = await cacheService.get<CourseListResult>(
            cacheKey,
            CacheOperationPriority.NORMAL
          );
          
          if (cachedResults) {
            return cachedResults;
          }
        }
        
        // Build the query
        let coursesRef = collection(db, 'courses');
        let constraints = [];
        
        // Add filters
        if (name) {
          constraints.push(where('nameTokens', 'array-contains', name.toLowerCase()));
        }
        
        if (location) {
          constraints.push(where('location.formattedLocation', '==', location));
        }
        
        if (userId) {
          constraints.push(where('createdBy', '==', userId));
        }
        
        // Add sorting
        constraints.push(orderBy(sortBy, sortDirection));
        
        // Add pagination
        constraints.push(limit(itemLimit));
        
        if (lastVisible) {
          constraints.push(startAfter(lastVisible));
        }
        
        // Create the final query
        const finalQuery = query(coursesRef, ...constraints);
        
        // Execute the query
        const querySnapshot = await getDocs(finalQuery);
        
        // Process results
        const courses: Course[] = [];
        let newLastVisible: QueryDocumentSnapshot<any> | null = null;
        
        if (!querySnapshot.empty) {
          newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
          
          querySnapshot.forEach(doc => {
            const data = doc.data() as Omit<Course, 'id' | 'teeBoxes' | 'holes'>;
            const course: Course = {
              id: doc.id,
              ...data,
              teeBoxes: [],
              holes: []
            };
            courses.push(course);
          });
        }
        
        const result: CourseListResult = {
          courses,
          hasMore: querySnapshot.docs.length === itemLimit,
          lastVisible: newLastVisible
        };
        
        // Cache search results if this is a simple name search
        if (name && !location && !userId && !lastVisible) {
          const cacheKey = `course_search_${name}_${itemLimit}`;
          await cacheService.set(
            cacheKey,
            result,
            { ttl: CACHE_TTL.SEARCH_RESULTS },
            CacheOperationPriority.LOW
          );
        }
        
        return result;
      } catch (error) {
        throw new CourseError(
          `Failed to search courses: ${(error as Error).message}`,
          CourseErrorType.SERVER_ERROR,
          error as Error
        );
      }
    }
  
    /**
     * Get recently played courses by a user
     */
    static async getRecentlyPlayedCourses(userId: string, limit = 5): Promise<Course[]> {
      try {
        // Try to get from cache first
        const cacheKey = `user_recent_courses_${userId}_${limit}`;
        const cachedCourses = await cacheService.get<Course[]>(
          cacheKey,
          CacheOperationPriority.NORMAL
        );
        
        if (cachedCourses) {
          return cachedCourses;
        }
        
        // Query for recent scorecards by the user
        const scorecardsQuery = query(
          collection(db, 'scorecards'),
          where('userId', '==', userId),
          orderBy('date', 'desc'),
          limit(20 as number) // Get more than we need to find distinct courses
        );
        
        const scorecardsSnapshot = await getDocs(scorecardsQuery);
        
        // Extract unique course IDs
        const courseIds = new Set<string>();
        scorecardsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.courseId) {
            courseIds.add(data.courseId);
          }
        });
        
        // Limit to requested number
        const limitedCourseIds = Array.from(courseIds).slice(0, limit);
        
        // Fetch course data in parallel
        const coursePromises = limitedCourseIds.map(id => this.getCourse(id));
        const courses = await Promise.all(coursePromises);
        
        // Cache the results
        await cacheService.set(
          cacheKey,
          courses,
          { ttl: 5 * 60 * 1000 }, // 5 minutes
          CacheOperationPriority.LOW
        );
        
        return courses;
      } catch (error) {
        console.error('Error getting recently played courses:', error);
        return []; // Return empty array on error
      }
    }
  
    /**
     * Convert scorecard holes to course holes
     * This is useful for creating a new course from a played round
     */
    static scorecardHolesToCourseHoles(scorecardHoles: any[]): HoleData[] {
      return scorecardHoles.map((hole, index) => ({
        number: index + 1,
        par: hole.par || 4,
        distance: hole.distance || 350,
        handicapIndex: hole.handicapIndex || index + 1
      }));
    }
  
    /**
     * Convert course holes to scorecard holes
     * This is useful for initializing a new scorecard
     */
    static courseHolesToScorecardHoles(courseHoles: HoleData[]): any[] {
      return courseHoles.map(hole => ({
        number: hole.number,
        par: hole.par,
        score: 0,
        fairwayHit: null,
        greenInRegulation: false,
        putts: 0,
        penalties: 0
      }));
    }
  }
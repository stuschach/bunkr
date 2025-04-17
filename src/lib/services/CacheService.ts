// src/lib/services/CacheService.ts
'use client';

import { logger } from '../utils/logger';
import { jobQueue, JobPriority } from './JobQueueService';
import { TeeTimeFilters } from '@/types/tee-times';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Define priority levels for cache operations
export enum CacheOperationPriority {
  CRITICAL = 0,  // Essential operations that should never be delayed
  HIGH = 1,      // Important operations
  NORMAL = 2,    // Standard operations
  LOW = 3,       // Background/non-essential operations
  MAINTENANCE = 4 // Cleanup and optimization tasks
}

// Key format constants for consistent caching
export const CACHE_KEYS = {
  // Message data keys
  CHAT: (chatId: string) => `chat_${chatId}`,
  MESSAGES: (chatId: string, limit: number = 50) => `messages_${chatId}_${limit}`,
  USER_CHATS: (userId: string) => `user_chats_${userId}`,
  UNREAD_COUNTS: (userId: string) => `unread_counts_${userId}`,
  
  // User data keys
  USER_PROFILE: (userId: string) => `user_${userId}`,
  CHAT_PARTICIPANT: (chatId: string, userId: string) => `chat_${chatId}_user_${userId}`,
  
  // Scorecard data keys
  SCORECARD: (scorecardId: string) => `scorecard_${scorecardId}`,
  USER_SCORECARDS: (userId: string) => `user_scorecards_${userId}`,
  COURSE: (courseId: string) => `course_${courseId}`,
  COURSE_TEEBOXES: (courseId: string) => `course_teeboxes_${courseId}`,
  COURSE_HOLES: (courseId: string) => `course_holes_${courseId}`,
  COMPLETE_COURSE: (courseId: string) => `complete_course_${courseId}`,
  COURSE_LIST: () => 'course_list',
  USER_STATS: (userId: string) => `user_stats_${userId}`,
  HANDICAP: (userId: string) => `handicap_${userId}`,
  SCORECARD_STATS: (scorecardId: string) => `scorecard_stats_${scorecardId}`,

  // Tee Time keys
  TEE_TIME: (teeTimeId: string) => `tee_time_${teeTimeId}`,
  TEE_TIME_PLAYERS: (teeTimeId: string) => `tee_time_${teeTimeId}_players`,
  TEE_TIME_PLAYER: (teeTimeId: string, userId: string) => `tee_time_${teeTimeId}_player_${userId}`,
  TEE_TIME_LIST: (filters?: string) => `tee_times_list_${filters || 'all'}`,
  USER_TEE_TIMES: (userId: string) => `user_${userId}_tee_times`,
  TEE_TIME_SEARCH: (query: string) => `tee_time_search_${query.toLowerCase().trim()}`
};

// TTL constants in milliseconds
export const CACHE_TTL = {
  USER_PROFILE: 5 * 60 * 1000,     // 5 minutes
  CHAT: 5 * 60 * 1000,             // 5 minutes
  MESSAGES: 60 * 1000,             // 1 minute
  USER_CHATS: 5 * 60 * 1000,       // 5 minutes
  UNREAD_COUNTS: 30 * 1000,        // 30 seconds
  SEARCH_RESULTS: 2 * 60 * 1000,   // 2 minutes
  
  // Scorecard cache TTLs
  SCORECARD: 60 * 60 * 1000,       // 1 hour
  USER_SCORECARDS: 5 * 60 * 1000,  // 5 minutes
  COURSE: 24 * 60 * 60 * 1000,     // 24 hours
  COURSE_LIST: 6 * 60 * 60 * 1000, // 6 hours
  USER_STATS: 15 * 60 * 1000,      // 15 minutes
  HANDICAP: 30 * 60 * 1000,        // 30 minutes
  SCORECARD_STATS: 60 * 60 * 1000, // 1 hour
  
  // Tee Time TTLs
  TEE_TIME: 10 * 60 * 1000,        // 10 minutes
  TEE_TIME_LIST: 5 * 60 * 1000,    // 5 minutes
  TEE_TIME_PLAYERS: 2 * 60 * 1000, // 2 minutes
  USER_TEE_TIMES: 5 * 60 * 1000,   // 5 minutes
  TEE_TIME_SEARCH: 5 * 60 * 1000   // 5 minutes
};

// For IndexedDB types - will be dynamically imported in browser
interface IDBPDatabase {
  objectStoreNames: DOMStringList;
  transaction: Function;
  createObjectStore: Function;
}

interface CacheItem<T> {
  data: T;
  expiry: number;
  lastAccessed: number;
}

interface CacheOptions {
  ttl?: number; // Time-to-live in milliseconds
  maxItems?: number; // Maximum number of items to store in the cache
  disableSanitization?: boolean; // Option to disable sanitization for performance
  highPriority?: boolean; // Option to mark as high priority for cache retention
}

/**
 * Enhanced Cache Service with improved reliability and performance
 */
class CacheService {
  // Database and store names
  private readonly DB_NAME = 'bunkr-cache';
  private readonly STORE_NAME = 'cached-data';
  
  // Default settings
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly DEFAULT_MAX_ITEMS = 500;
  private readonly DEFAULT_MAINTENANCE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  // Memory cache for fast access and fallback
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  
  // IndexedDB state
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private initialized = false;
  private initializationAttempted = false;
  
  // Import state
  private openDBModule: any = null;
  private importPromise: Promise<void> | null = null;
  
  // Maintenance state
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private lastMaintenance = 0;
  
  /**
   * Constructor with optional configuration
   */
  constructor(private options: CacheOptions = {}) {
    // Only initialize in browser environment
    if (isBrowser) {
      // Delay initialization to not block main thread
      setTimeout(() => this.initializeWhenReady(), 100);
      
      // Set up recurring maintenance
      this.setupMaintenance();
    }
  }

  /**
   * Initialize when the IndexedDB module is ready
   */
  private async initializeWhenReady(): Promise<void> {
    if (this.initializationAttempted) return;
    this.initializationAttempted = true;
    
    try {
      await this.loadIndexedDBModule();
      // Use setTimeout to ensure this runs after component mounting
      setTimeout(() => this.initializeDB(), 0);
    } catch (error) {
      logger.error('Failed to initialize IndexedDB module:', error);
    }
  }

  /**
   * Dynamically load the IndexedDB module
   */
  private async loadIndexedDBModule(): Promise<void> {
    if (!isBrowser || this.openDBModule) return;
    
    if (!this.importPromise) {
      this.importPromise = import('idb')
        .then(module => {
          this.openDBModule = module.openDB;
        })
        .catch(err => {
          logger.error('Failed to load IndexedDB library:', err);
        });
    }
    
    return this.importPromise;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initializeDB(): Promise<void> {
    // Skip if not in browser, module not loaded, or already initialized
    if (!isBrowser || !this.openDBModule || this.initialized) return;
    
    try {
      this.dbPromise = this.openDBModule(this.DB_NAME, 1, {
        upgrade(db: IDBPDatabase) {
          // Create the object store if it doesn't exist
          if (!db.objectStoreNames.contains('cached-data')) {
            const store = db.createObjectStore('cached-data');
            // Create an index for expiry to help with cleanup
            store.createIndex('expiry', 'expiry');
            // Create an index for lastAccessed to help with LRU eviction
            store.createIndex('lastAccessed', 'lastAccessed');
          }
        }
      });
      
      this.initialized = true;
      
      // Perform initial cleanup as a background job
      this.scheduleCleanup();
    } catch (error) {
      logger.error('Failed to initialize cache database:', error);
      this.dbPromise = null;
    }
  }

  /**
   * Set up maintenance interval
   */
  private setupMaintenance(): void {
    if (!isBrowser || this.maintenanceInterval) return;
    
    // Set up interval for periodic maintenance
    this.maintenanceInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMaintenance = now - this.lastMaintenance;
      
      // Only run maintenance if sufficient time has passed
      if (timeSinceLastMaintenance > this.DEFAULT_MAINTENANCE_INTERVAL) {
        this.lastMaintenance = now;
        this.runMaintenance(CacheOperationPriority.MAINTENANCE)
          .catch(err => logger.error('Cache maintenance error:', err));
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Clean up maintenance resources
   */
  public cleanup(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  /**
   * Lightweight sanitization function that just JSON serializes and deserializes
   */
  private fastSanitizeForStorage<T>(data: T): T {
    try {
      // Use JSON.stringify/parse as a quick way to strip non-serializable stuff
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      logger.warn('Failed to sanitize data for storage:', e);
      // Return the original data as fallback
      return data;
    }
  }
  
  /**
   * Get an item from the cache
   */
  async get<T>(
    key: string, 
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<T | null> {
    // Check memory cache first for speed
    const memItem = this.memoryCache.get(key);
    if (memItem && memItem.expiry > Date.now()) {
      // Update last accessed time
      memItem.lastAccessed = Date.now();
      return memItem.data;
    } else if (memItem) {
      // Remove expired item
      this.memoryCache.delete(key);
    }
    
    // If not in browser or DB not initialized, return null
    if (!isBrowser || !this.dbPromise || !this.initialized) {
      return null;
    }

    try {
      // Use job queue for reliability
      const { resultPromise } = await jobQueue.enqueue<T | null>(async () => {
        try {
          if (!this.dbPromise) {
            return null;
          }
          
          const db = await this.dbPromise;
          // Use readonly transaction for better performance
          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);

          // Get the cache item
          const cacheItem = await store.get(key) as CacheItem<T> | undefined;
          
          // Check if the item exists and is still valid
          if (!cacheItem || cacheItem.expiry < Date.now()) {
            if (cacheItem) {
              // Schedule removal of expired item (don't await)
              this.remove(key, CacheOperationPriority.LOW)
                .catch(() => {});
            }
            return null;
          }

          // Update memory cache with the fetched item
          this.memoryCache.set(key, cacheItem);
          
          // Schedule update of lastAccessed as a separate task (don't await)
          this.updateLastAccessed(key, Date.now(), CacheOperationPriority.LOW)
            .catch(() => {});

          await tx.done;
          return cacheItem.data;
        } catch (error) {
          logger.error('Failed to get item from cache:', error);
          return null;
        }
      }, {
        priority: this.mapToJobPriority(priority),
        jobId: `cache_get_${key}`,
        // Short timeout since this should be fast
        timeout: 5000
      });
      
      return await resultPromise;
    } catch (error) {
      logger.error('Error in cache get operation:', error);
      return null;
    }
  }

  /**
   * Store an item in the cache
   */
  async set<T>(
    key: string, 
    data: T, 
    options?: CacheOptions, 
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<void> {
    const ttl = options?.ttl || this.options.ttl || this.DEFAULT_TTL;
    const now = Date.now();
    
    // Skip operations if data is null/undefined
    if (data === null || data === undefined) return;
    
    // Apply fast sanitization by default unless disabled
    const disableSanitization = options?.disableSanitization ?? this.options.disableSanitization ?? false;
    const dataToStore = disableSanitization ? data : this.fastSanitizeForStorage(data);

    const cacheItem: CacheItem<T> = {
      data: dataToStore,
      expiry: now + ttl,
      lastAccessed: now
    };

    // Always store in memory cache for fast access and fallback
    this.memoryCache.set(key, cacheItem);
    
    // Skip IndexedDB if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) {
      return;
    }
    
    // Store in IndexedDB using job queue for reliability
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);

        // Store the sanitized item
        await store.put(cacheItem, key);
        await tx.done;
        
        // Occasionally schedule maintenance
        if (Math.random() < 0.05) { // 5% chance
          this.scheduleCleanup();
        }
      } catch (error) {
        logger.error('Failed to set item in cache:', error);
        // Already in memory cache, so no additional fallback needed
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: `cache_set_${key}`,
      // Use sequence group to ensure updates to the same key are processed in order
      sequenceGroup: `cache_key_${key}`
    });
  }

  /**
   * Update the lastAccessed time for a cache item without getting the full data
   */
  private async updateLastAccessed(
    key: string, 
    time: number, 
    priority: CacheOperationPriority = CacheOperationPriority.LOW
  ): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        
        const item = await store.get(key) as CacheItem<any> | undefined;
        if (item) {
          item.lastAccessed = time;
          await store.put(item, key);
        }
        
        await tx.done;
      } catch (error) {
        logger.warn('Failed to update lastAccessed time:', error);
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: `cache_touch_${key}`,
      // Lower timeout since this is a simple operation
      timeout: 3000
    });
  }

  /**
   * Remove an item from the cache
   */
  async remove(
    key: string, 
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<void> {
    // Always remove from memory cache
    this.memoryCache.delete(key);
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        await store.delete(key);
        await tx.done;
      } catch (error) {
        logger.error('Failed to remove item from cache:', error);
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: `cache_remove_${key}`,
      // Use sequence group to ensure operations on the same key are ordered
      sequenceGroup: `cache_key_${key}`
    });
  }

  /**
   * Get an item from the cache with fallback function
   */
  async getFallback<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<T> {
    // Try to get from cache first
    const cachedItem = await this.get<T>(key, priority);
    if (cachedItem !== null) {
      return cachedItem;
    }
    
    // Execute fallback function
    try {
      const data = await fallbackFn();
      
      // Cache the result if not null/undefined
      if (data !== null && data !== undefined) {
        await this.set(key, data, undefined, priority);
      }
      
      return data;
    } catch (error) {
      logger.error(`Fallback function failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add specific fallback method for course data
   */
  async getCourseData<T>(
    courseId: string,
    dataType: 'course' | 'teeBoxes' | 'holes' | 'complete',
    fallbackFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Use different priorities based on data type
    let priority: CacheOperationPriority;
    let cacheKey: string;
    let cacheTtl: number;
    
    switch(dataType) {
      case 'course':
        priority = CacheOperationPriority.HIGH;
        cacheKey = CACHE_KEYS.COURSE(courseId);
        cacheTtl = ttl || CACHE_TTL.COURSE;
        break;
      case 'teeBoxes':
        priority = CacheOperationPriority.HIGH;
        cacheKey = CACHE_KEYS.COURSE_TEEBOXES(courseId);
        cacheTtl = ttl || CACHE_TTL.COURSE;
        break;
      case 'holes':
        priority = CacheOperationPriority.CRITICAL;
        cacheKey = CACHE_KEYS.COURSE_HOLES(courseId);
        cacheTtl = ttl || CACHE_TTL.COURSE;
        break;
      case 'complete':
        priority = CacheOperationPriority.HIGH;
        cacheKey = CACHE_KEYS.COMPLETE_COURSE(courseId);
        cacheTtl = ttl || CACHE_TTL.COURSE;
        break;
      default:
        priority = CacheOperationPriority.NORMAL;
        cacheKey = `course_data_${courseId}_${dataType}`;
        cacheTtl = ttl || CACHE_TTL.COURSE;
    }
    
    return this.getFallback<T>(
      cacheKey,
      fallbackFn,
      priority
    );
  }

  /**
   * Clear all items from the cache
   */
  async clear(): Promise<void> {
    // Always clear memory cache
    this.memoryCache.clear();
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        await store.clear();
        await tx.done;
      } catch (error) {
        logger.error('Failed to clear cache:', error);
      }
    }, {
      priority: JobPriority.LOW,
      jobId: 'cache_clear'
    });
  }

  /**
   * Maintain the memory cache by removing oldest items
   */
  private maintainMemoryCache(): void {
    const maxItems = this.options.maxItems || this.DEFAULT_MAX_ITEMS;
    
    if (this.memoryCache.size <= maxItems) return;
    
    // Remove expired items first
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
        expiredCount++;
      }
    }
    
    // If still over limit, remove by LRU
    if (this.memoryCache.size > maxItems) {
      // Sort by accessed time (oldest first)
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      // Remove oldest items
      const itemsToRemove = this.memoryCache.size - maxItems;
      for (let i = 0; i < itemsToRemove; i++) {
        if (entries[i]) {
          this.memoryCache.delete(entries[i][0]);
        }
      }
    }
  }

  /**
   * Schedule a background cleanup job
   */
  private scheduleCleanup(): void {
    // Skip if not in browser or job queue not available
    if (!isBrowser || !jobQueue) return;
    
    jobQueue.enqueue<void>(async () => {
      await this.cleanExpired(CacheOperationPriority.MAINTENANCE);
      
      // Enforce size limits
      const maxItems = this.options.maxItems || this.DEFAULT_MAX_ITEMS;
      
      // Only check DB if initialized
      if (this.initialized && this.dbPromise) {
        try {
          const db = await this.dbPromise;
          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);
          
          const count = await store.count();
          await tx.done;
          
          if (count > maxItems) {
            await this.enforceSizeLimit(maxItems, CacheOperationPriority.MAINTENANCE);
          }
        } catch (error) {
          logger.error('Error checking cache size:', error);
        }
      }
      
      // Always maintain memory cache
      this.maintainMemoryCache();
    }, {
      priority: JobPriority.MAINTENANCE,
      jobId: 'cache_cleanup_scheduled',
      timeout: 30000 // 30 second timeout for cleanup
    });
  }

  /**
   * Run overall maintenance tasks in the background
   */
  private async runMaintenance(
    priority: CacheOperationPriority = CacheOperationPriority.MAINTENANCE
  ): Promise<void> {
    if (!isBrowser) return;
    
    // Maintain memory cache regardless of IndexedDB state
    this.maintainMemoryCache();
    
    // Skip IndexedDB operations if not initialized
    if (!this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        // Clean expired items
        await this.cleanExpired(priority);
        
        // Enforce size limits if needed
        const maxItems = this.options.maxItems || this.DEFAULT_MAX_ITEMS;
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        
        const count = await store.count();
        await tx.done;
        
        if (count > maxItems) {
          await this.enforceSizeLimit(maxItems, priority);
        }
      } catch (error) {
        logger.error('Failed to run cache maintenance:', error);
      }
    }, {
      priority: JobPriority.MAINTENANCE,
      jobId: 'cache_maintenance'
    });
  }

  /**
   * Clean expired items from the cache
   */
  async cleanExpired(
    priority: CacheOperationPriority = CacheOperationPriority.MAINTENANCE
  ): Promise<void> {
    // Clean memory cache
    const now = Date.now();
    Array.from(this.memoryCache.entries()).forEach(([key, item]) => {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
      }
    });
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const expiryIndex = store.index('expiry');
        
        // Use a simple cursor to find expired items
        let cursor = await expiryIndex.openCursor();
        let count = 0;
        const batchLimit = 100; // Process in small batches
        
        while (cursor && count < batchLimit) {
          if (cursor.value.expiry < now) {
            await cursor.delete();
            count++;
          } else {
            // Since the index is sorted, we can stop once we find
            // an item that isn't expired
            break;
          }
          cursor = await cursor.continue();
        }
        
        await tx.done;
        
        // If we hit the batch limit, schedule another cleanup
        if (count >= batchLimit) {
          this.scheduleCleanup();
        }
      } catch (error) {
        logger.error('Failed to clean expired cache items:', error);
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: 'cache_clean_expired'
    });
  }

  /**
   * Enforce maximum cache size using LRU policy
   */
  private async enforceSizeLimit(
    maxItems: number,
    priority: CacheOperationPriority = CacheOperationPriority.MAINTENANCE
  ): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        
        // Get the total count
        const count = await store.count();
        
        // If we're under the limit, no need to do anything
        if (count <= maxItems) {
          await tx.done;
          return;
        }
        
        // Otherwise, we need to evict some items (LRU policy)
        const itemsToRemove = Math.min(count - maxItems, 50); // Remove in batches of 50 max
        
        if (itemsToRemove <= 0) {
          await tx.done;
          return;
        }
        
        // Use LRU policy - remove least recently accessed items
        const accessIndex = store.index('lastAccessed');
        let lruCursor = await accessIndex.openCursor();
        let removedCount = 0;
        
        while (lruCursor && removedCount < itemsToRemove) {
          await lruCursor.delete();
          removedCount++;
          lruCursor = await lruCursor.continue();
        }
        
        await tx.done;
        
        // If we still have items to remove, schedule another run
        if (count - removedCount > maxItems) {
          this.scheduleCleanup();
        }
      } catch (error) {
        logger.error('Failed to enforce cache size limit:', error);
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: 'cache_enforce_size_limit'
    });
  }

  /**
   * Remove all cache items with a specific prefix
   */
  async removeByPrefix(
    prefix: string,
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<void> {
    // Clear from memory cache first
    const keysToRemove: string[] = [];
    this.memoryCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    });
    
    // Remove matched keys from memory cache
    keysToRemove.forEach(key => this.memoryCache.delete(key));
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await jobQueue.enqueue<void>(async () => {
      try {
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        
        // Get all keys and filter those that match the prefix
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const allKeys = await store.getAllKeys() as string[];
        await tx.done;
        
        const keysWithPrefix = allKeys.filter(key => 
          typeof key === 'string' && key.startsWith(prefix)
        );
        
        if (keysWithPrefix.length === 0) {
          return;
        }
        
        // Delete matched keys in batches to avoid long-running transactions
        const batchSize = 50;
        for (let i = 0; i < keysWithPrefix.length; i += batchSize) {
          const batch = keysWithPrefix.slice(i, i + batchSize);
          
          // Use a new transaction for each batch
          const deleteTx = db.transaction(this.STORE_NAME, 'readwrite');
          const deleteStore = deleteTx.objectStore(this.STORE_NAME);
          
          // Delete each key in this batch
          await Promise.all(batch.map(key => deleteStore.delete(key)));
          await deleteTx.done;
        }
      } catch (error) {
        logger.error(`Failed to remove items with prefix ${prefix}:`, error);
      }
    }, {
      priority: this.mapToJobPriority(priority),
      jobId: `cache_remove_prefix_${prefix}`
    });
  }

  /**
   * Get all cache keys
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.initialized || !this.dbPromise) {
      // Return from memory cache if IndexedDB not available
      return Array.from(this.memoryCache.keys());
    }
    
    try {
      const db = await this.dbPromise;
      return db.transaction(this.STORE_NAME, 'readonly')
        .objectStore(this.STORE_NAME)
        .getAllKeys() as Promise<string[]>;
    } catch (error) {
      logger.error('Error getting all cache keys:', error);
      return Array.from(this.memoryCache.keys());
    }
  }

  /**
   * Invalidate user cache
   */
  invalidateUserCache(userId: string, priority: CacheOperationPriority = CacheOperationPriority.NORMAL): Promise<void> {
    return this.removeByPrefix(`user_${userId}`, priority);
  }

  /**
   * Helper method for tee time filters to cache key
   */
  getTeeTimeFiltersCacheKey(filters?: TeeTimeFilters): string {
    if (!filters) return 'all';
    
    const parts: string[] = [];
    
    if (filters.status) parts.push(`status:${filters.status}`);
    if (filters.date) parts.push(`date:${filters.date.toISOString().split('T')[0]}`);
    if (filters.courseId) parts.push(`course:${filters.courseId}`);
    if (filters.maxDistance) parts.push(`dist:${filters.maxDistance}`);
    
    return parts.join('_') || 'all';
  }

  /**
   * Helper method to cache a tee time
   */
  cacheTeeTime<T>(teeTime: T & { id?: string }, priority: CacheOperationPriority = CacheOperationPriority.NORMAL) {
    if (!teeTime || !teeTime.id) return;
    
    return this.set(
      CACHE_KEYS.TEE_TIME(teeTime.id),
      teeTime,
      { ttl: CACHE_TTL.TEE_TIME },
      priority
    );
  }

  /**
   * Cache a list of tee times
   */
  cacheTeeTimeList<T>(
    teeTimes: T[],
    filters?: TeeTimeFilters,
    lastVisible?: any,
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ) {
    const filterKey = this.getTeeTimeFiltersCacheKey(filters);
    const paginationKey = lastVisible ? `_page_${lastVisible.id || 'next'}` : '';
    
    return this.set(
      CACHE_KEYS.TEE_TIME_LIST(filterKey + paginationKey),
      { teeTimes, lastVisible },
      { ttl: CACHE_TTL.TEE_TIME_LIST },
      priority
    );
  }

  /**
   * Cache user's tee times
   */
  cacheUserTeeTimes<T>(
    userId: string,
    teeTimes: T[],
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ) {
    if (!userId) return;
    
    return this.set(
      CACHE_KEYS.USER_TEE_TIMES(userId),
      teeTimes,
      { ttl: CACHE_TTL.USER_TEE_TIMES },
      priority
    );
  }

  /**
   * Invalidate all tee time related caches
   */
  invalidateTeeTimeCache(teeTimeId: string) {
    // Remove specific tee time cache
    this.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
    
    // Remove tee time players
    this.remove(CACHE_KEYS.TEE_TIME_PLAYERS(teeTimeId), CacheOperationPriority.HIGH);
    
    // Remove any cache with the tee time id
    this.removeByPrefix(`tee_time_${teeTimeId}`, CacheOperationPriority.NORMAL);
    
    // Remove list caches as they may contain this tee time
    this.removeByPrefix('tee_times_list', CacheOperationPriority.LOW);
  }

  /**
   * Invalidate all user-related tee time caches
   */
  invalidateUserTeeTimeCache(userId: string) {
    if (!userId) return;
    
    // Remove user's tee times
    this.remove(CACHE_KEYS.USER_TEE_TIMES(userId), CacheOperationPriority.HIGH);
    
    // Remove user-specific tee time caches
    this.removeByPrefix(`user_${userId}_tee`, CacheOperationPriority.NORMAL);
    
    // User's activity may affect tee time lists
    this.removeByPrefix('tee_times_list', CacheOperationPriority.LOW);
  }
  
  /**
   * Helper method to invalidate a specific scorecard cache
   */
  invalidateScorecardCache(scorecardId: string): Promise<void> {
    return Promise.all([
      this.remove(CACHE_KEYS.SCORECARD(scorecardId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.SCORECARD_STATS(scorecardId), CacheOperationPriority.HIGH)
    ]).then(() => {});
  }

  /**
   * Helper method to invalidate all user's scorecards cache
   */
  invalidateUserScorecards(userId: string): Promise<void> {
    return Promise.all([
      this.remove(CACHE_KEYS.USER_SCORECARDS(userId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.USER_STATS(userId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.HANDICAP(userId), CacheOperationPriority.HIGH)
    ]).then(() => {});
  }
  
  /**
   * Helper method to invalidate all course-related caches
   */
  invalidateCourseCache(courseId: string): Promise<void> {
    return Promise.all([
      this.removeByPrefix(`course_${courseId}`, CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.COURSE(courseId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.COURSE_HOLES(courseId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.COURSE_TEEBOXES(courseId), CacheOperationPriority.HIGH),
      this.remove(CACHE_KEYS.COMPLETE_COURSE(courseId), CacheOperationPriority.HIGH)
    ]).then(() => {});
  }
  
  /**
   * Map cache operation priority to job priority
   */
  private mapToJobPriority(priority: CacheOperationPriority): JobPriority {
    switch(priority) {
      case CacheOperationPriority.CRITICAL:
        return JobPriority.CRITICAL;
      case CacheOperationPriority.HIGH:
        return JobPriority.HIGH;
      case CacheOperationPriority.NORMAL:
        return JobPriority.NORMAL;
      case CacheOperationPriority.LOW:
        return JobPriority.LOW;
      case CacheOperationPriority.MAINTENANCE:
        return JobPriority.MAINTENANCE;
      default:
        return JobPriority.NORMAL;
    }
  }
}

// Create singleton instance
const cacheServiceInstance = new CacheService({
  ttl: 30 * 60 * 1000, // 30 minutes default TTL
  maxItems: 1000, // Store up to 1000 items by default
  disableSanitization: false // Enable by default, can be overridden
});

// Export the singleton instance
export const cacheService = cacheServiceInstance;

// Export types and enums
export default CacheService;
// src/lib/services/CacheService.ts
'use client';

// Import only the types, not the actual implementation
import type { IDBPDatabase, OpenDBCallbacks, StoreNames } from 'idb';
import EventEmitter from 'events';

// Define priority levels
export enum CacheOperationPriority {
  CRITICAL = 0,  // Essential operations that should never be delayed
  HIGH = 1,      // Important operations
  NORMAL = 2,    // Standard operations
  LOW = 3        // Background/non-essential operations
}

// Define operation type
interface CacheOperation {
  id: string;
  execute: () => Promise<any>;
  priority: CacheOperationPriority;
  timeAdded: number;
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
  SCORECARD_STATS: (scorecardId: string) => `scorecard_stats_${scorecardId}`
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
  SCORECARD_STATS: 60 * 60 * 1000  // 1 hour
};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize module variables
// Fix #1: Proper type for openDBModule
let openDBModule: typeof import('idb').openDB | null = null;
let importPromise: Promise<void> | null = null;

// Safe initialization function to load the IndexedDB library
function initializeIndexedDB(): Promise<void> {
  if (!isBrowser) return Promise.resolve();
  
  if (!importPromise) {
    importPromise = import('idb')
      .then(module => {
        openDBModule = module.openDB;
      })
      .catch(err => {
        console.error('Failed to load IndexedDB library:', err);
      });
  }
  
  return importPromise;
}

// Start loading the module right away if in browser
if (isBrowser) {
  initializeIndexedDB();
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
}

class CacheService {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private readonly DB_NAME = 'bunkr-cache';
  private readonly STORE_NAME = 'cached-data';
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly DEFAULT_MAX_ITEMS = 200;
  private memoryCache: Map<string, CacheItem<any>> = new Map(); // Fallback for server-side
  private initialized = false;
  
  // Improve pending operations tracking
  private pendingOperations = 0;
  private MAX_PENDING_OPERATIONS = 25; // Increased from 10 to 25
  
  // Add queue for operations
  private operationQueue: CacheOperation[] = [];
  private isProcessingQueue = false;
  // Fix #7: Properly type the EventEmitter
  private operationEmitter: EventEmitter = new EventEmitter();
  
  constructor(private options: CacheOptions = {}) {
    // Increase event emitter max listeners to avoid warnings
    this.operationEmitter.setMaxListeners(30);
    
    // Set up operation queue processing
    this.operationEmitter.on('operationCompleted', () => {
      this.processOperationQueue();
    });
    
    // Only initialize in browser environment and after module is loaded
    if (isBrowser) {
      // Delay initialization to not block main thread
      setTimeout(() => this.initializeWhenReady(), 100);
    }
  }

  private async initializeWhenReady(): Promise<void> {
    try {
      await initializeIndexedDB();
      // Use setTimeout to ensure this runs after component mounting
      setTimeout(() => this.init(), 0);
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
    }
  }

  private async init(): Promise<void> {
    // Skip initialization if not in browser or module not loaded
    if (!isBrowser || !openDBModule) return;
    
    // Skip if already initialized
    if (this.initialized) return;
    
    try {
      // Fix #3: Properly type the upgrade function parameter
      this.dbPromise = openDBModule(this.DB_NAME, 1, {
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
      
      // Perform initial cleanup
      this.cleanExpired().catch(err => {
        console.warn('Initial cache cleanup failed:', err);
      });
    } catch (error) {
      console.error('Failed to initialize cache database:', error);
      this.dbPromise = null;
    }
  }

  /**
   * Lightweight sanitization function that just JSON serializes and deserializes
   * This is much faster but less thorough than deep traversal
   */
  private fastSanitizeForStorage<T>(data: T): T {
    try {
      // Use JSON.stringify/parse as a quick way to strip non-serializable stuff
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to sanitize data for storage, falling back to original:', e);
      // If serialization fails, return the original data and let the browser handle it
      // It might still work for memory cache even if IndexedDB fails
      return data;
    }
  }

  /**
   * Add an operation to the queue
   * @param operation The operation to execute
   * @param priority Priority level for this operation
   * @returns A promise that resolves when the operation completes
   */
  private async queueOperation<T>(
    operation: () => Promise<T>, 
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<T> {
    // Fast path - if we can execute immediately, just do it
    if (this.pendingOperations < this.MAX_PENDING_OPERATIONS) {
      this.pendingOperations++;
      try {
        return await operation();
      } finally {
        this.pendingOperations--;
        this.operationEmitter.emit('operationCompleted');
      }
    }
    
    // Need to queue
    return new Promise<T>((resolve, reject) => {
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedOperation: CacheOperation = {
        id: operationId,
        execute: async () => {
          try {
            this.pendingOperations++;
            const result = await operation();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          } finally {
            this.pendingOperations--;
            this.operationEmitter.emit('operationCompleted');
          }
        },
        priority,
        timeAdded: Date.now()
      };
      
      this.operationQueue.push(queuedOperation);
      
      // Sort queue by priority then by time added
      this.sortQueue();
      
      // Start processing queue if not already
      if (!this.isProcessingQueue) {
        // Fix #9: Fix potential timing issue in queue processing
        setTimeout(() => this.processOperationQueue(), 0);
      }
    });
  }
  
  /**
   * Sort the operation queue by priority and then by time added
   */
  private sortQueue(): void {
    // Fix #8: Fix array sort callback parameter types
    this.operationQueue.sort((a: CacheOperation, b: CacheOperation) => {
      // First sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then sort by time added (older first)
      return a.timeAdded - b.timeAdded;
    });
  }
  
  /**
   * Process operations in the queue
   */
  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Process as many operations as possible up to MAX_PENDING_OPERATIONS
      while (this.operationQueue.length > 0 && 
             this.pendingOperations < this.MAX_PENDING_OPERATIONS) {
        const nextOp = this.operationQueue.shift();
        if (nextOp) {
          try {
            await nextOp.execute();
          } catch (error) {
            console.error(`Error executing queued operation ${nextOp.id}:`, error);
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
      
      // If there are still items in queue and capacity available, continue processing
      if (this.operationQueue.length > 0 && this.pendingOperations < this.MAX_PENDING_OPERATIONS) {
        setTimeout(() => this.processOperationQueue(), 0);
      }
    }
  }

  /**
   * Get an item from the cache
   * @param key The cache key
   * @param priority Priority for this operation
   * @returns The cached data or null if not found or expired
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

    return this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
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
            this.remove(key, CacheOperationPriority.LOW).catch(() => {});
          }
          return null;
        }

        // Update memory cache with the fetched item
        this.memoryCache.set(key, cacheItem);
        
        // Schedule update of lastAccessed (don't await to keep this fast)
        this.updateLastAccessed(key, Date.now(), CacheOperationPriority.LOW).catch(() => {});

        await tx.done;
        return cacheItem.data;
      } catch (error) {
        console.error('Failed to get item from cache:', error);
        return null;
      }
    }, priority);
  }

  /**
   * Store an item in the cache
   * @param key The cache key
   * @param data The data to cache
   * @param options Optional cache options
   * @param priority Priority for this operation
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
    
    // Simple memory cache maintenance (async)
    setTimeout(() => this.maintainMemoryCache(), 0);

    // Skip IndexedDB if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) {
      return;
    }
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);

        // Store the sanitized item
        await store.put(cacheItem, key);
        await tx.done;
        
        // Schedule maintenance in the background with low priority
        if (Math.random() < 0.1) { // 10% chance to run maintenance
          this.runMaintenance(CacheOperationPriority.LOW).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to set item in cache:', error);
        // Already in memory cache, so no additional fallback needed
      }
    }, priority);
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
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        
        // Fix #5: Add proper type for retrieved item
        const item = await store.get(key) as CacheItem<any> | undefined;
        if (item) {
          item.lastAccessed = time;
          await store.put(item, key);
        }
        
        await tx.done;
      } catch (error) {
        console.warn('Failed to update lastAccessed time:', error);
      }
    }, priority);
  }

  /**
   * Remove an item from the cache
   * @param key The cache key
   * @param priority Priority for this operation
   */
  async remove(
    key: string, 
    priority: CacheOperationPriority = CacheOperationPriority.NORMAL
  ): Promise<void> {
    // Always remove from memory cache
    this.memoryCache.delete(key);
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        await store.delete(key);
        await tx.done;
      } catch (error) {
        console.error('Failed to remove item from cache:', error);
      }
    }, priority);
  }

  /**
   * Get an item from the cache with fallback function
   * @param key The cache key
   * @param fallbackFn Function to call if item is not found in cache
   * @param priority Priority for the cache operation
   * @returns The cached data or result of fallback function
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
      console.error(`Fallback function failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add specific fallback method for course data
   */
  // Fix #6: Add proper type constraint for getCourseData
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
    
    // Try to get from cache first
    const cachedItem = await this.get<T>(cacheKey, priority);
    if (cachedItem !== null) {
      return cachedItem;
    }
    
    // Execute fallback function
    try {
      const data = await fallbackFn();
      
      // Cache the result if not null/undefined
      if (data !== null && data !== undefined) {
        await this.set(cacheKey, data, { ttl: cacheTtl }, priority);
      }
      
      return data;
    } catch (error) {
      console.error(`Course data fallback function failed for ${dataType}:`, error);
      throw error;
    }
  }

  /**
   * Clear all items from the cache
   */
  async clear(): Promise<void> {
    // Always clear memory cache
    this.memoryCache.clear();
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        await store.clear();
        await tx.done;
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }, CacheOperationPriority.LOW);
  }

  /**
   * Maintain the memory cache by removing oldest items
   */
  private maintainMemoryCache(): void {
    const maxItems = this.options.maxItems || this.DEFAULT_MAX_ITEMS;
    
    if (this.memoryCache.size <= maxItems) return;
    
    // Remove oldest accessed items
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

  /**
   * Run overall maintenance tasks in the background
   */
  private async runMaintenance(
    priority: CacheOperationPriority = CacheOperationPriority.LOW
  ): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
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
        console.error('Failed to run cache maintenance:', error);
      }
    }, priority);
  }

  /**
   * Clean expired items from the cache
   */
  async cleanExpired(
    priority: CacheOperationPriority = CacheOperationPriority.LOW
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
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const expiryIndex = store.index('expiry');
        
        let cursor = await expiryIndex.openCursor();
        
        while (cursor) {
          if (cursor.value.expiry < now) {
            await cursor.delete();
          } else {
            // Since the index is sorted, we can stop once we find
            // an item that isn't expired
            break;
          }
          cursor = await cursor.continue();
        }
        
        await tx.done;
      } catch (error) {
        console.error('Failed to clean expired cache items:', error);
      }
    }, priority);
  }

  /**
   * Enforce maximum cache size using LRU policy
   */
  private async enforceSizeLimit(
    maxItems: number,
    priority: CacheOperationPriority = CacheOperationPriority.LOW
  ): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
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
        const itemsToRemove = count - maxItems;
        
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
      } catch (error) {
        console.error('Failed to enforce cache size limit:', error);
      }
    }, priority);
  }

  /**
   * Remove all cache items with a specific prefix
   * @param prefix The key prefix to match
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
    
    await this.queueOperation(async () => {
      try {
        // Fix #4: Proper null checking for dbPromise
        if (!this.dbPromise) {
          return;
        }
        
        const db = await this.dbPromise;
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        
        // Unfortunately, IDB doesn't support prefix queries directly
        // We need to scan all keys and filter
        let cursor = await store.openCursor();
        while (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            await cursor.delete();
          }
          cursor = await cursor.continue();
        }
        
        await tx.done;
      } catch (error) {
        console.error(`Failed to remove items with prefix ${prefix}:`, error);
      }
    }, priority);
  }

  /**
   * Helper method to invalidate all course-related caches for a specific course
   * @param courseId The course ID to invalidate
   */
  async invalidateCourseCache(courseId: string): Promise<void> {
    await this.removeByPrefix(`course_${courseId}`, CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.COURSE(courseId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.COURSE_HOLES(courseId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.COURSE_TEEBOXES(courseId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.COMPLETE_COURSE(courseId), CacheOperationPriority.HIGH);
  }

  /**
   * Helper method to invalidate a specific scorecard cache
   * @param scorecardId The scorecard ID to invalidate
   */
  async invalidateScorecardCache(scorecardId: string): Promise<void> {
    await this.remove(CACHE_KEYS.SCORECARD(scorecardId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.SCORECARD_STATS(scorecardId), CacheOperationPriority.HIGH);
  }

  /**
   * Helper method to invalidate all user's scorecards cache
   * @param userId The user ID whose scorecards to invalidate
   */
  async invalidateUserScorecards(userId: string): Promise<void> {
    await this.remove(CACHE_KEYS.USER_SCORECARDS(userId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.USER_STATS(userId), CacheOperationPriority.HIGH);
    await this.remove(CACHE_KEYS.HANDICAP(userId), CacheOperationPriority.HIGH);
  }
}

// Use lazy initialization for the singleton
let cacheServiceInstance: CacheService | null = null;

// Access the cache service through this function to ensure lazy initialization
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService({
      ttl: 30 * 60 * 1000, // 30 minutes default TTL
      maxItems: 500, // Store up to 500 items by default
      disableSanitization: false // Enable by default, can be overridden
    });
  }
  return cacheServiceInstance;
}

// Export the singleton getter function
export const cacheService = getCacheService();

// Also export the class for creating specialized caches
export default CacheService;
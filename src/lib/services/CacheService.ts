// src/lib/services/CacheService.ts
'use client';

// Import only the types, not the actual implementation
import type { IDBPDatabase } from 'idb';

// Key format constants for consistent caching
export const CACHE_KEYS = {
  // Message data keys
  CHAT: (chatId: string) => `chat_${chatId}`,
  MESSAGES: (chatId: string, limit: number = 50) => `messages_${chatId}_${limit}`,
  USER_CHATS: (userId: string) => `user_chats_${userId}`,
  UNREAD_COUNTS: (userId: string) => `unread_counts_${userId}`,
  
  // User data keys
  USER_PROFILE: (userId: string) => `user_${userId}`,
  CHAT_PARTICIPANT: (chatId: string, userId: string) => `chat_${chatId}_user_${userId}`
};

// TTL constants in milliseconds
export const CACHE_TTL = {
  USER_PROFILE: 5 * 60 * 1000,     // 5 minutes
  CHAT: 5 * 60 * 1000,             // 5 minutes
  MESSAGES: 60 * 1000,             // 1 minute
  USER_CHATS: 5 * 60 * 1000,       // 5 minutes
  UNREAD_COUNTS: 30 * 1000,        // 30 seconds
  SEARCH_RESULTS: 2 * 60 * 1000    // 2 minutes
};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize module variables
let openDBModule: any = null;
let importPromise: Promise<void> | null = null;

// Safe initialization function to load the IndexedDB library
function initializeIndexedDB() {
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
  private pendingOperations = 0;
  private MAX_PENDING_OPERATIONS = 10;

  constructor(private options: CacheOptions = {}) {
    // Only initialize in browser environment and after module is loaded
    if (isBrowser) {
      // Delay initialization to not block main thread
      setTimeout(() => this.initializeWhenReady(), 100);
    }
  }

  private async initializeWhenReady() {
    try {
      await initializeIndexedDB();
      // Use setTimeout to ensure this runs after component mounting
      setTimeout(() => this.init(), 0);
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
    }
  }

  private async init() {
    // Skip initialization if not in browser or module not loaded
    if (!isBrowser || !openDBModule) return;
    
    // Skip if already initialized
    if (this.initialized) return;
    
    try {
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
   * Get an item from the cache
   * @param key The cache key
   * @returns The cached data or null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
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

    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB access');
      return null;
    }

    try {
      this.pendingOperations++;
      
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
          this.remove(key).catch(() => {});
        }
        return null;
      }

      // Update memory cache with the fetched item
      this.memoryCache.set(key, cacheItem);
      
      // Schedule update of lastAccessed (don't await to keep this fast)
      this.updateLastAccessed(key, Date.now()).catch(() => {});

      await tx.done;
      return cacheItem.data;
    } catch (error) {
      console.error('Failed to get item from cache:', error);
      return null;
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Update the lastAccessed time for a cache item without getting the full data
   * This is a performance optimization
   */
  private async updateLastAccessed(key: string, time: number): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    try {
      this.pendingOperations++;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      const item = await store.get(key);
      if (item) {
        item.lastAccessed = time;
        await store.put(item, key);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update lastAccessed time:', error);
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Store an item in the cache
   * @param key The cache key
   * @param data The data to cache
   * @param options Optional cache options
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
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
    
    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB write');
      return;
    }

    try {
      this.pendingOperations++;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);

      // Store the sanitized item
      await store.put(cacheItem, key);
      await tx.done;
      
      // Schedule maintenance in the background (don't await)
      if (Math.random() < 0.1) { // 10% chance to run maintenance
        this.runMaintenance().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to set item in cache:', error);
      // Already in memory cache, so no additional fallback needed
    } finally {
      this.pendingOperations--;
    }
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
  private async runMaintenance(): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    try {
      this.pendingOperations++;
      
      // Clean expired items
      await this.cleanExpired();
      
      // Enforce size limits if needed
      const maxItems = this.options.maxItems || this.DEFAULT_MAX_ITEMS;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      const count = await store.count();
      await tx.done;
      
      if (count > maxItems) {
        await this.enforceSizeLimit(maxItems);
      }
    } catch (error) {
      console.error('Failed to run cache maintenance:', error);
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Remove an item from the cache
   * @param key The cache key
   */
  async remove(key: string): Promise<void> {
    // Always remove from memory cache
    this.memoryCache.delete(key);
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB delete');
      return;
    }

    try {
      this.pendingOperations++;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await store.delete(key);
      await tx.done;
    } catch (error) {
      console.error('Failed to remove item from cache:', error);
    } finally {
      this.pendingOperations--;
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
    
    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB clear');
      return;
    }

    try {
      this.pendingOperations++;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await store.clear();
      await tx.done;
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Clean expired items from the cache
   */
  async cleanExpired(): Promise<void> {
    // Clean memory cache
    const now = Date.now();
    Array.from(this.memoryCache.entries()).forEach(([key, item]) => {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
      }
    });
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB cleanup');
      return;
    }

    try {
      this.pendingOperations++;
      
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
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Enforce maximum cache size using LRU policy
   */
  private async enforceSizeLimit(maxItems: number): Promise<void> {
    if (!isBrowser || !this.dbPromise || !this.initialized) return;
    
    try {
      this.pendingOperations++;
      
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
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Remove all cache items with a specific prefix
   * @param prefix The key prefix to match
   */
  async removeByPrefix(prefix: string): Promise<void> {
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
    
    // Check if we have too many pending operations
    if (this.pendingOperations >= this.MAX_PENDING_OPERATIONS) {
      console.warn('Too many pending cache operations, skipping DB prefix removal');
      return;
    }

    try {
      this.pendingOperations++;
      
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
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Get the size of the memory cache
   * @returns The number of items in the memory cache
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Get all keys in the cache
   * @returns Array of keys in the cache
   */
  async getAllKeys(): Promise<string[]> {
    // For memory cache, this is straightforward
    const memoryKeys = Array.from(this.memoryCache.keys());
    
    // Skip if not in browser or DB not ready
    if (!isBrowser || !this.dbPromise || !this.initialized) {
      return memoryKeys;
    }
    
    try {
      this.pendingOperations++;
      
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      const allKeys = await store.getAllKeys() as string[];
      await tx.done;
      
      // Combine and deduplicate keys from both sources
      return [...new Set([...memoryKeys, ...allKeys])];
    } catch (error) {
      console.error('Failed to get all cache keys:', error);
      return memoryKeys;
    } finally {
      this.pendingOperations--;
    }
  }

  /**
   * Helper method to invalidate all cache related to a specific chat
   * @param chatId The chat ID to invalidate
   */
  async invalidateChatCache(chatId: string): Promise<void> {
    await this.removeByPrefix(`chat_${chatId}`);
    await this.removeByPrefix(`messages_${chatId}`);
  }

  /**
   * Helper method to invalidate all user-related caches
   * @param userId The user ID to invalidate
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.removeByPrefix(`user_${userId}`);
    await this.removeByPrefix(`user_chats_${userId}`);
    await this.removeByPrefix(`unread_counts_${userId}`);
  }

  /**
   * Helper method to invalidate all messaging-related caches
   */
  async invalidateAllMessagingCache(): Promise<void> {
    await this.removeByPrefix('chat_');
    await this.removeByPrefix('messages_');
    await this.removeByPrefix('user_chats_');
    await this.removeByPrefix('unread_counts_');
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
// src/lib/services/listener-manager.ts

// Statistics for performance monitoring
export interface ListenerStats {
    created: number;
    destroyed: number;
    maxConcurrent: number;
    currentActive: number;
    activationTimes: Map<string, number>; // Maps postId to activation timestamp
    averageLifetime: number;
  }
  
  /**
   * Service to centralize management of Firestore listeners
   * Ensures efficient use of resources by limiting concurrent listeners
   */
  class ListenerManager {
    // Map of active listeners: postId -> unsubscribe function
    private activeListeners: Map<string, () => void> = new Map();
    
    // Configuration
    private maxConcurrentListeners: number = 15; // Adjust based on performance testing
    private inactivityBuffer: number = 1000; // Time in ms to keep listeners before deactivation
    private listenerTimeouts: Map<string, NodeJS.Timeout> = new Map();
    
    // Statistics for monitoring
    private stats: ListenerStats = {
      created: 0,
      destroyed: 0,
      maxConcurrent: 0,
      currentActive: 0,
      activationTimes: new Map(),
      averageLifetime: 0
    };
  
    /**
     * Activate a listener for a post
     * @param postId The post ID
     * @param createListener Function that creates and returns the unsubscribe function
     * @param priority Higher priority (0-10) will be less likely to be removed when at capacity
     */
    activateListener(postId: string, createListener: () => (() => void), priority: number = 5): void {
      // Clear any pending deactivation
      if (this.listenerTimeouts.has(postId)) {
        clearTimeout(this.listenerTimeouts.get(postId)!);
        this.listenerTimeouts.delete(postId);
        return; // Listener is already active
      }
      
      // If already active, do nothing
      if (this.activeListeners.has(postId)) return;
      
      // If we're at max capacity, remove lowest priority listener
      if (this.activeListeners.size >= this.maxConcurrentListeners) {
        this._removeOldestListener();
      }
      
      // Create and store the listener
      const unsubscribe = createListener();
      this.activeListeners.set(postId, unsubscribe);
      
      // Update statistics
      this.stats.created++;
      this.stats.currentActive = this.activeListeners.size;
      this.stats.maxConcurrent = Math.max(this.stats.maxConcurrent, this.activeListeners.size);
      this.stats.activationTimes.set(postId, Date.now());
      
      console.debug(`Listener activated for post ${postId}. Active count: ${this.activeListeners.size}`);
    }
    
    /**
     * Schedule a listener for deactivation after a buffer period
     * This prevents thrashing when scrolling quickly
     */
    scheduleDeactivation(postId: string): void {
      // Skip if not active
      if (!this.activeListeners.has(postId)) return;
      
      // Clear any existing timeout
      if (this.listenerTimeouts.has(postId)) {
        clearTimeout(this.listenerTimeouts.get(postId)!);
      }
      
      // Set new timeout
      const timeoutId = setTimeout(() => {
        this.deactivateListener(postId);
      }, this.inactivityBuffer);
      
      this.listenerTimeouts.set(postId, timeoutId);
    }
    
    /**
     * Immediately deactivate a listener
     */
    deactivateListener(postId: string): void {
      const unsubscribe = this.activeListeners.get(postId);
      if (!unsubscribe) return;
      
      // Clean up the listener
      unsubscribe();
      this.activeListeners.delete(postId);
      
      // Clear any pending timeout
      if (this.listenerTimeouts.has(postId)) {
        clearTimeout(this.listenerTimeouts.get(postId)!);
        this.listenerTimeouts.delete(postId);
      }
      
      // Update statistics
      this.stats.destroyed++;
      this.stats.currentActive = this.activeListeners.size;
      
      // Calculate lifetime if we have activation time
      if (this.stats.activationTimes.has(postId)) {
        const activationTime = this.stats.activationTimes.get(postId)!;
        const lifetime = Date.now() - activationTime;
        this.stats.activationTimes.delete(postId);
        
        // Update average lifetime
        const totalListeners = this.stats.created;
        this.stats.averageLifetime = (this.stats.averageLifetime * (totalListeners - 1) + lifetime) / totalListeners;
      }
      
      console.debug(`Listener deactivated for post ${postId}. Active count: ${this.activeListeners.size}`);
    }
    
    /**
     * Deactivate all listeners
     */
    deactivateAll(): void {
      // Clean up all timeouts
      this.listenerTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this.listenerTimeouts.clear();
      
      // Clean up all listeners
      this.activeListeners.forEach((unsubscribe, postId) => {
        unsubscribe();
        
        // Update statistics for each
        this.stats.destroyed++;
        if (this.stats.activationTimes.has(postId)) {
          const activationTime = this.stats.activationTimes.get(postId)!;
          const lifetime = Date.now() - activationTime;
          
          // Update average lifetime
          const totalListeners = this.stats.created;
          this.stats.averageLifetime = (this.stats.averageLifetime * (totalListeners - 1) + lifetime) / totalListeners;
        }
      });
      
      this.activeListeners.clear();
      this.stats.activationTimes.clear();
      this.stats.currentActive = 0;
      
      console.debug('All listeners deactivated');
    }
    
    /**
     * Get current listener statistics
     */
    getStats(): ListenerStats {
      return {...this.stats};
    }
    
    /**
     * Remove the oldest listener when we hit capacity
     */
    private _removeOldestListener(): void {
      if (this.activeListeners.size === 0) return;
      
      // Find the oldest listener
      let oldestTime = Infinity;
      let oldestPostId: string | null = null;
      
      this.stats.activationTimes.forEach((time, postId) => {
        if (this.activeListeners.has(postId) && time < oldestTime) {
          oldestTime = time;
          oldestPostId = postId;
        }
      });
      
      // Deactivate the oldest listener
      if (oldestPostId) {
        console.debug(`Removing oldest listener (${oldestPostId}) due to capacity limit`);
        this.deactivateListener(oldestPostId);
      }
    }
    
    /**
     * Configure the manager
     */
    configure(options: { maxConcurrentListeners?: number; inactivityBuffer?: number }) {
      if (options.maxConcurrentListeners) {
        this.maxConcurrentListeners = options.maxConcurrentListeners;
      }
      
      if (options.inactivityBuffer) {
        this.inactivityBuffer = options.inactivityBuffer;
      }
    }
  }
  
  // Export a singleton instance
  export const listenerManager = new ListenerManager();
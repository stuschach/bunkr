// src/lib/services/OfflineManager.ts
import { Scorecard, HoleData } from '@/types/scorecard';
import { ScorecardService } from '@/lib/services/ScorecardService';
import { cacheService } from '@/lib/services/CacheService';

// Key for local storage
const OFFLINE_SCORECARDS_KEY = 'bunkr_offline_scorecards';
const OFFLINE_OPERATIONS_KEY = 'bunkr_offline_operations';

// Operation types for offline queue
export type OfflineOperation = {
  id: string;
  type: 'create' | 'update' | 'delete' | 'updateHole';
  timestamp: number;
  data: any;
  userId: string;
};

/**
 * Service for managing offline scorecard operations
 */
export class OfflineManager {
  /**
   * Check if the application is online
   */
  static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }
  
  /**
   * Save a scorecard to local storage for offline use
   */
  static saveOfflineScorecard(scorecard: Scorecard): void {
    try {
      // Get existing offline scorecards
      const offlineScorecards = this.getOfflineScorecards();
      
      // Add or update the scorecard
      offlineScorecards[scorecard.id] = {
        ...scorecard,
        _offlineUpdatedAt: Date.now()
      };
      
      // Save back to local storage
      localStorage.setItem(OFFLINE_SCORECARDS_KEY, JSON.stringify(offlineScorecards));
    } catch (error) {
      console.error('Error saving offline scorecard:', error);
    }
  }
  
  /**
   * Get all offline scorecards
   */
  static getOfflineScorecards(): Record<string, Scorecard> {
    try {
      const item = localStorage.getItem(OFFLINE_SCORECARDS_KEY);
      return item ? JSON.parse(item) : {};
    } catch (error) {
      console.error('Error getting offline scorecards:', error);
      return {};
    }
  }
  
  /**
   * Get a specific offline scorecard
   */
  static getOfflineScorecard(scorecardId: string): Scorecard | null {
    try {
      const offlineScorecards = this.getOfflineScorecards();
      return offlineScorecards[scorecardId] || null;
    } catch (error) {
      console.error('Error getting offline scorecard:', error);
      return null;
    }
  }
  
  /**
   * Queue an offline operation to be processed when online
   */
  static queueOfflineOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp'>): string {
    try {
      // Generate a unique ID for this operation
      const operationId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Get existing operations
      const operations = this.getOfflineOperations();
      
      // Add the new operation
      operations.push({
        ...operation,
        id: operationId,
        timestamp: Date.now()
      });
      
      // Save back to local storage
      localStorage.setItem(OFFLINE_OPERATIONS_KEY, JSON.stringify(operations));
      
      return operationId;
    } catch (error) {
      console.error('Error queueing offline operation:', error);
      return '';
    }
  }
  
  /**
   * Get all queued offline operations
   */
  static getOfflineOperations(): OfflineOperation[] {
    try {
      const item = localStorage.getItem(OFFLINE_OPERATIONS_KEY);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error('Error getting offline operations:', error);
      return [];
    }
  }
  
  /**
   * Remove a processed operation from the queue
   */
  static removeOfflineOperation(operationId: string): void {
    try {
      const operations = this.getOfflineOperations();
      const updatedOperations = operations.filter(op => op.id !== operationId);
      localStorage.setItem(OFFLINE_OPERATIONS_KEY, JSON.stringify(updatedOperations));
    } catch (error) {
      console.error('Error removing offline operation:', error);
    }
  }
  
  /**
   * Process all queued offline operations when back online
   */
  static async processOfflineOperations(userId: string): Promise<string[]> {
    if (!this.isOnline()) {
      return [];
    }
    
    const operations = this.getOfflineOperations()
      .filter(op => op.userId === userId)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (operations.length === 0) {
      return [];
    }
    
    const results: string[] = [];
    const errors: string[] = [];
    
    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'create':
            await ScorecardService.createScorecard(operation.data, userId);
            break;
            
          case 'update':
            await ScorecardService.updateScorecard(
              operation.data.id,
              operation.data,
              userId
            );
            break;
            
          case 'delete':
            await ScorecardService.deleteScorecard(operation.data.id, userId);
            break;
            
          case 'updateHole':
            await ScorecardService.updateHoleData(
              operation.data.scorecardId,
              operation.data.holeNumber,
              operation.data.holeData,
              userId
            );
            break;
        }
        
        // Record success
        results.push(operation.id);
        
        // Remove the operation from the queue
        this.removeOfflineOperation(operation.id);
      } catch (error) {
        console.error(`Error processing offline operation ${operation.id}:`, error);
        errors.push(operation.id);
      }
    }
    
    return results;
  }
  
  /**
   * Create a scorecard while offline
   */
  static createOfflineScorecard(
    data: Partial<Scorecard>,
    userId: string
  ): Scorecard {
    // Generate a temporary ID
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Initialize holes if needed
    const holes: HoleData[] = data.holes || Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      score: 0,
      fairwayHit: null,
      greenInRegulation: false,
      putts: 0,
      penalties: 0
    }));
    
    // Calculate stats
    const stats = ScorecardService.calculateStats(holes);
    
    // Create a scorecard object
    const scorecard: Scorecard = {
      id: tempId,
      userId,
      courseId: data.courseId || 'offline_course',
      courseName: data.courseName || 'Offline Course',
      coursePar: data.coursePar || 72,
      date: data.date || new Date().toISOString().split('T')[0],
      totalScore: stats.totalScore,
      scoreToPar: stats.totalScore - (data.coursePar || 72),
      courseHandicap: data.courseHandicap || null,
      holes,
      teeBox: data.teeBox || {
        name: 'White',
        rating: 72.0,
        slope: 113,
        yardage: 6200
      },
      stats,
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      isCompleted: false,
      state: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      _isOffline: true
    };
    
    // Save to offline storage
    this.saveOfflineScorecard(scorecard);
    
    // Queue the operation for when we're back online
    this.queueOfflineOperation({
      type: 'create',
      data,
      userId
    });
    
    return scorecard;
  }
  
  /**
   * Update a scorecard while offline
   */
  static updateOfflineScorecard(
    scorecardId: string,
    data: Partial<Scorecard>,
    userId: string
  ): Scorecard | null {
    // Get the existing scorecard
    const existingScorecard = this.getOfflineScorecard(scorecardId);
    
    if (!existingScorecard) {
      console.error(`Offline scorecard with ID ${scorecardId} not found`);
      return null;
    }
    
    // Check authorization
    if (existingScorecard.userId !== userId) {
      console.error('Unauthorized to update offline scorecard');
      return null;
    }
    
    // Calculate new stats if holes are updated
    let stats = existingScorecard.stats;
    if (data.holes) {
      stats = ScorecardService.calculateStats(data.holes);
    }
    
    // Update the scorecard
    const updatedScorecard: Scorecard = {
      ...existingScorecard,
      ...data,
      stats,
      totalScore: stats.totalScore || 0,
      scoreToPar: (stats.totalScore || 0) - (data.coursePar || existingScorecard.coursePar),
      updatedAt: new Date(),
      _isOffline: true
    };
    
    // Save to offline storage
    this.saveOfflineScorecard(updatedScorecard);
    
    // Queue the operation for when we're back online
    this.queueOfflineOperation({
      type: 'update',
      data: {
        id: scorecardId,
        ...data
      },
      userId
    });
    
    return updatedScorecard;
  }
  
  /**
   * Update a hole in a scorecard while offline
   */
  static updateOfflineHoleData(
    scorecardId: string,
    holeNumber: number,
    holeData: Partial<HoleData>,
    userId: string
  ): Scorecard | null {
    // Get the existing scorecard
    const existingScorecard = this.getOfflineScorecard(scorecardId);
    
    if (!existingScorecard) {
      console.error(`Offline scorecard with ID ${scorecardId} not found`);
      return null;
    }
    
    // Check authorization
    if (existingScorecard.userId !== userId) {
      console.error('Unauthorized to update offline scorecard hole');
      return null;
    }
    
    // Update the hole
    const updatedHoles = [...existingScorecard.holes];
    const holeIndex = holeNumber - 1;
    
    if (!updatedHoles[holeIndex]) {
      console.error(`Hole ${holeNumber} not found in scorecard ${scorecardId}`);
      return null;
    }
    
    updatedHoles[holeIndex] = {
      ...updatedHoles[holeIndex],
      ...holeData
    };
    
    // Calculate new stats
    const stats = ScorecardService.calculateStats(updatedHoles);
    
    // Update the scorecard
    const updatedScorecard: Scorecard = {
      ...existingScorecard,
      holes: updatedHoles,
      stats,
      totalScore: stats.totalScore,
      scoreToPar: stats.totalScore - existingScorecard.coursePar,
      updatedAt: new Date(),
      _isOffline: true
    };
    
    // Save to offline storage
    this.saveOfflineScorecard(updatedScorecard);
    
    // Queue the operation for when we're back online
    this.queueOfflineOperation({
      type: 'updateHole',
      data: {
        scorecardId,
        holeNumber,
        holeData
      },
      userId
    });
    
    return updatedScorecard;
  }
  
  /**
   * Check if a scorecard is available offline
   */
  static isScorecardAvailableOffline(scorecardId: string): boolean {
    return !!this.getOfflineScorecard(scorecardId);
  }
  
  /**
   * Setup online/offline listeners to synchronize data
   */
  static setupSyncListeners(userId: string): void {
    if (typeof window === 'undefined') return;
    
    // When the app comes back online, process queued operations
    window.addEventListener('online', async () => {
      console.log('Back online, processing queued operations...');
      try {
        await this.processOfflineOperations(userId);
      } catch (error) {
        console.error('Error processing offline operations:', error);
      }
    });
    
    // When the app goes offline, we can notify the user
    window.addEventListener('offline', () => {
      console.log('Application is offline. Changes will be saved locally.');
    });
  }
  
  /**
   * Prefetch and cache a scorecard for offline use
   */
  static async prefetchScorecard(scorecardId: string, userId: string): Promise<boolean> {
    try {
      // Check if already offline
      if (this.isScorecardAvailableOffline(scorecardId)) {
        return true;
      }
      
      // Fetch the scorecard
      const scorecard = await ScorecardService.getScorecard(scorecardId, userId);
      
      // Save to offline storage
      this.saveOfflineScorecard(scorecard);
      
      // Also cache in the CacheService
      await cacheService.set(
        `scorecard_${scorecardId}`, 
        scorecard, 
        { ttl: 86400000 } // 24 hours
      );
      
      return true;
    } catch (error) {
      console.error('Error prefetching scorecard:', error);
      return false;
    }
  }
  
  /**
   * Get user scorecards available offline
   */
  static getOfflineUserScorecards(userId: string): Scorecard[] {
    try {
      const allScorecards = this.getOfflineScorecards();
      
      return Object.values(allScorecards)
        .filter(scorecard => scorecard.userId === userId)
        .sort((a, b) => {
          // Sort by updated date, newest first
          const aDate = a._offlineUpdatedAt || (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          const bDate = b._offlineUpdatedAt || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
          return bDate - aDate;
        });
    } catch (error) {
      console.error('Error getting offline user scorecards:', error);
      return [];
    }
  }
  
  /**
   * Clear all offline data
   */
  static clearOfflineData(): void {
    try {
      localStorage.removeItem(OFFLINE_SCORECARDS_KEY);
      localStorage.removeItem(OFFLINE_OPERATIONS_KEY);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }
}

// Export singleton
export default OfflineManager;
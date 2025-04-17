// src/lib/services/cache-extensions.ts
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheOperationPriority } from '@/lib/services/CacheService';
import { TeeTime, TeeTimeFilters } from '@/types/tee-times';

/**
 * Cache extensions for tee time functionality
 * Add this to your application startup process
 */
export function initializeTeeTimeCache() {
  // Add tee time specific cache keys
  Object.assign(CACHE_KEYS, {
    TEE_TIME: (teeTimeId: string) => `tee_time_${teeTimeId}`,
    TEE_TIME_PLAYERS: (teeTimeId: string) => `tee_time_${teeTimeId}_players`,
    TEE_TIME_PLAYER: (teeTimeId: string, userId: string) => `tee_time_${teeTimeId}_player_${userId}`,
    TEE_TIME_LIST: (filters?: string) => `tee_times_list_${filters || 'all'}`,
    USER_TEE_TIMES: (userId: string) => `user_${userId}_tee_times`,
    TEE_TIME_SEARCH: (query: string) => `tee_time_search_${query.toLowerCase().trim()}`
  });
  
  // Add tee time specific cache TTLs
  Object.assign(CACHE_TTL, {
    TEE_TIME: 10 * 60 * 1000, // 10 minutes
    TEE_TIME_LIST: 5 * 60 * 1000, // 5 minutes
    TEE_TIME_PLAYERS: 2 * 60 * 1000, // 2 minutes
    USER_TEE_TIMES: 5 * 60 * 1000, // 5 minutes
    TEE_TIME_SEARCH: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Helper to create a cache key for tee time filters
 */
export function getTeeTimeFiltersCacheKey(filters?: TeeTimeFilters): string {
  if (!filters) return 'all';
  
  const parts: string[] = [];
  
  if (filters.status) parts.push(`status:${filters.status}`);
  if (filters.date) parts.push(`date:${filters.date.toISOString().split('T')[0]}`);
  if (filters.courseId) parts.push(`course:${filters.courseId}`);
  if (filters.maxDistance) parts.push(`dist:${filters.maxDistance}`);
  
  return parts.join('_') || 'all';
}

/**
 * Cache a tee time
 */
export function cacheTeeTime(teeTime: TeeTime, priority: CacheOperationPriority = CacheOperationPriority.NORMAL) {
  if (!teeTime || !teeTime.id) return;
  
  return cacheService.set(
    CACHE_KEYS.TEE_TIME(teeTime.id),
    teeTime,
    { ttl: CACHE_TTL.TEE_TIME },
    priority
  );
}

/**
 * Cache a list of tee times
 */
export function cacheTeeTimeList(
  teeTimes: TeeTime[],
  filters?: TeeTimeFilters,
  lastVisible?: any,
  priority: CacheOperationPriority = CacheOperationPriority.NORMAL
) {
  const filterKey = getTeeTimeFiltersCacheKey(filters);
  const paginationKey = lastVisible ? `_page_${lastVisible.id || 'next'}` : '';
  
  return cacheService.set(
    CACHE_KEYS.TEE_TIME_LIST(filterKey + paginationKey),
    { teeTimes, lastVisible },
    { ttl: CACHE_TTL.TEE_TIME_LIST },
    priority
  );
}

/**
 * Cache user's tee times
 */
export function cacheUserTeeTimes(
  userId: string,
  teeTimes: TeeTime[],
  priority: CacheOperationPriority = CacheOperationPriority.NORMAL
) {
  if (!userId) return;
  
  return cacheService.set(
    CACHE_KEYS.USER_TEE_TIMES(userId),
    teeTimes,
    { ttl: CACHE_TTL.USER_TEE_TIMES },
    priority
  );
}

/**
 * Invalidate all tee time related caches
 */
export function invalidateTeeTimeCache(teeTimeId: string) {
  // Remove specific tee time cache
  cacheService.remove(CACHE_KEYS.TEE_TIME(teeTimeId), CacheOperationPriority.HIGH);
  
  // Remove tee time players
  cacheService.remove(CACHE_KEYS.TEE_TIME_PLAYERS(teeTimeId), CacheOperationPriority.HIGH);
  
  // Remove any cache with the tee time id
  cacheService.removeByPrefix(`tee_time_${teeTimeId}`, CacheOperationPriority.NORMAL);
  
  // Remove list caches as they may contain this tee time
  cacheService.removeByPrefix('tee_times_list', CacheOperationPriority.LOW);
}

/**
 * Invalidate all user-related tee time caches
 */
export function invalidateUserTeeTimeCache(userId: string) {
  if (!userId) return;
  
  // Remove user's tee times
  cacheService.remove(CACHE_KEYS.USER_TEE_TIMES(userId), CacheOperationPriority.HIGH);
  
  // Remove user-specific tee time caches
  cacheService.removeByPrefix(`user_${userId}_tee`, CacheOperationPriority.NORMAL);
  
  // User's activity may affect tee time lists
  cacheService.removeByPrefix('tee_times_list', CacheOperationPriority.LOW);
}

// Initialize the cache extensions
initializeTeeTimeCache();
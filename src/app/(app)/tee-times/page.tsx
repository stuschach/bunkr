// src/app/(app)/tee-times/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeCard } from '@/components/tee-times/TeeTimeCard';
import { TeeTimeFiltersComponent } from '@/components/tee-times/TeeTimeFilters';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { 
  TeeTime, 
  TeeTimeFilters, 
  UserProfile 
} from '@/types/tee-times';
import { 
  PlusCircle, 
  RefreshCw, 
  Calendar, 
  Users, 
  Search,
  MapPin,
  Filter,
  ChevronDown,
  AlertCircle,
  Mail
} from 'lucide-react';
import { DocumentSnapshot } from 'firebase/firestore';

export default function TeeTimes() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    error, 
    getPublicTeeTimesList, 
    getUserProfile,
    getUsersByIds,
    joinTeeTime,
    pendingOperations,
    showToast
  } = useTeeTime();
  
  // State
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [creators, setCreators] = useState<{[key: string]: UserProfile | null}>({});
  const [filters, setFilters] = useState<TeeTimeFilters>({
    status: 'open',
    date: null,
    showInvitedOnly: false
  });
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // NEW: Add a refreshKey state to force refresh when needed
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Load tee times with optimized profile fetching
  const fetchTeeTimes = useCallback(async (reset: boolean = false) => {
    try {
      const newFilters = reset ? { status: 'open' as 'open', date: null } : filters;
      const currentLastVisible = reset ? null : lastVisible;
      
      if (reset) {
        setFilters(newFilters);
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      // FIXED: Now properly handles the paginated response
      const result = await getPublicTeeTimesList(newFilters, currentLastVisible);
      
      if (reset) {
        setTeeTimes(result.teeTimes);
      } else {
        setTeeTimes(prev => [...prev, ...result.teeTimes]);
      }
      
      setLastVisible(result.lastVisible);
      setHasMore(result.teeTimes.length === 10); // Assuming 10 is the page size
      
      // OPTIMIZED: Fetch creator profiles in batch
      const creatorIds = result.teeTimes.map(teeTime => teeTime.creatorId);
      const uniqueCreatorIds = [...new Set(creatorIds)];
      
      if (uniqueCreatorIds.length > 0) {
        // Use batch loading instead of individual requests
        const profiles = await getUsersByIds(uniqueCreatorIds);
        
        // Update creators state
        const creatorProfiles: Record<string, UserProfile | null> = {};
        Object.entries(profiles).forEach(([id, profile]) => {
          creatorProfiles[id] = profile;
        });
        
        setCreators(prev => ({ ...prev, ...creatorProfiles }));
      }
    } catch (error) {
      console.error('Error fetching tee times:', error);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [filters, lastVisible, getPublicTeeTimesList, getUsersByIds]);
  
  // NEW: Add a refresh function for manual refresh
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setRefreshKey(prevKey => prevKey + 1);
  }, [isRefreshing]);
  
  // NEW: Add window focus event listener to refresh data when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only refresh if it's been at least 30 seconds since initial load
        const lastRefreshTime = Number(sessionStorage.getItem('lastTeeTimesRefresh') || '0');
        const now = Date.now();
        
        if (now - lastRefreshTime > 30000) { // 30 seconds
          handleRefresh();
          sessionStorage.setItem('lastTeeTimesRefresh', now.toString());
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);
  
  // Load initial tee times
  useEffect(() => {
    fetchTeeTimes(true);
    // Store refresh timestamp
    sessionStorage.setItem('lastTeeTimesRefresh', Date.now().toString());
  }, [refreshKey]); // NEW: Added refreshKey to dependencies
  
  // Handle filter changes
  const handleFilterChange = (newFilters: TeeTimeFilters) => {
    setFilters(newFilters);
    fetchTeeTimes(true);
  };
  
  // Handle load more
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    await fetchTeeTimes(false);
  };
  
  // Helper to check if current user is invited to a tee time
  const isUserInvited = (teeTime: TeeTime): boolean => {
    if (!user) return false;
    
    // Check if user is already a player in this tee time
    return !!teeTime.players?.some(
      player => player.userId === user.uid && 
      player.status === 'pending' && 
      player.requestType === 'invitation'
    );
  };
  
  // Helper to check if current user is already a part of a tee time
  const isUserPartOfTeeTime = (teeTime: TeeTime): boolean => {
    if (!user) return false;
    
    // Check if user is already a player in this tee time
    return !!teeTime.players?.some(
      player => player.userId === user.uid && 
      (player.status === 'confirmed' || player.status === 'pending')
    );
  };
  
  // IMPROVED: Better join request handling with validation and error handling
  const handleJoinRequest = async (teeTimeId: string) => {
    if (!user) {
      router.push('/login?returnUrl=/tee-times');
      return;
    }
    
    // Find the tee time
    const teeTime = teeTimes.find(tt => tt.id === teeTimeId);
    if (!teeTime) return;
    
    // Check if user is already part of this tee time
    if (isUserPartOfTeeTime(teeTime)) {
      // Show info toast
      showToast({
        title: 'Already Joined',
        description: 'You are already part of this tee time',
        variant: 'info'
      });
      return;
    }
    
    try {
      // Use the context function
      const success = await joinTeeTime(teeTimeId);
      
      if (success) {
        // Optimistically update the UI
        setTeeTimes(prev => prev.map(teeTime => {
          if (teeTime.id === teeTimeId) {
            return {
              ...teeTime,
              players: [
                ...(teeTime.players || []),
                {
                  userId: user.uid,
                  status: 'pending',
                  joinedAt: new Date(),
                  requestType: 'join_request'
                }
              ]
            };
          }
          return teeTime;
        }));
        
        // Success toast already shown by the context
      }
    } catch (error) {
      console.error('Error joining tee time:', error);
      
      // Error toast already shown by the context
    }
  };

  // Navigate to create tee time
  const handleCreateTeeTime = () => {
    router.push('/tee-times/create');
  };
  
  // Filter tee times by search query and user invitations if enabled
  const filteredTeeTimes = teeTimes
    .filter(teeTime => {
      // Apply text search filter
      const matchesSearch = !searchQuery.trim() || 
        teeTime.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teeTime.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
      // Apply invited-only filter if enabled
      const matchesInvited = !filters.showInvitedOnly || isUserInvited(teeTime);
      
      return matchesSearch && matchesInvited;
    });

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
      <div className="relative bg-gradient-to-r from-green-600 to-green-800 dark:from-green-800 dark:to-green-950">
        <div className="absolute inset-0 bg-[url('/images/golf-pattern.png')] opacity-10"></div>
        <div className="container mx-auto px-4 py-10 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between">
            <div className="text-white">
              <Heading level={1} className="font-bold text-3xl md:text-4xl mb-2">Tee Times</Heading>
              <Text className="text-green-100 mb-4 max-w-xl">
                Find and join group tee times at courses near you, or create your own and invite others to play
              </Text>
            </div>
            
            <Button
              onClick={handleCreateTeeTime}
              className="bg-white text-green-700 hover:bg-green-50 shadow-md transition-all duration-200 transform hover:scale-105"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Create Tee Time
            </Button>
          </div>
          
          <div className="mt-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search courses, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-1/2 pl-10 pr-4 py-3 rounded-full shadow-md border-0 focus:ring-2 focus:ring-green-500 bg-white text-gray-800"
            />
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 -mt-6">
        <TeeTimeFiltersComponent 
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          showInvitedFilter={true}
        />
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Text className="text-gray-600 dark:text-gray-400">
              {filteredTeeTimes.length} tee {filteredTeeTimes.length === 1 ? 'time' : 'times'} found
            </Text>
            
            {/* NEW: Add manual refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              disabled={isRefreshing}
              className="ml-2"
              aria-label="Refresh tee times"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`px-3 py-2 ${view === 'grid' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-2 ${view === 'list' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {initialLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <LoadingSpinner size="lg" color="primary" className="mx-auto mb-4" />
            <Text className="text-gray-600 dark:text-gray-400">Loading tee times...</Text>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
            <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 mb-4 inline-block">
              <svg className="h-8 w-8 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <Text className="text-gray-800 dark:text-gray-200 font-medium text-lg mb-2">
              Couldn't load tee times
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 mb-6">
              {error instanceof Error ? error.message : String(error)}
            </Text>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : filteredTeeTimes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-4 inline-flex mb-4">
              <Calendar className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <Text className="text-gray-800 dark:text-gray-200 font-medium text-lg mb-2">
              No tee times found
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery 
                ? "No tee times match your search query" 
                : filters.showInvitedOnly
                  ? "You don't have any pending invitations"
                  : "No tee times found matching your filters"}
            </Text>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  handleFilterChange({status: 'all', date: null, showInvitedOnly: false});
                }}
              >
                Clear Filters
              </Button>
              <Button onClick={handleCreateTeeTime}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Tee Time
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={`${view === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'} mb-8`}
            >
              {filteredTeeTimes.map(teeTime => {
                const userIsInvited = isUserInvited(teeTime);
                const userIsPartOfTeeTime = isUserPartOfTeeTime(teeTime);
                
                return (
                  <div key={teeTime.id} className={`${view === 'list' ? 'animate-fadeIn' : 'animate-scaleIn'} relative`}>
                    {/* Invitation Badge */}
                    {userIsInvited && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          Invited
                        </div>
                      </div>
                    )}
                    
                    {/* Already Joined Badge */}
                    {!userIsInvited && userIsPartOfTeeTime && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          Joined
                        </div>
                      </div>
                    )}
                    
                    <TeeTimeCard
                      teeTime={teeTime}
                      creator={creators[teeTime.creatorId] || undefined}
                      onJoinRequest={handleJoinRequest}
                      currentUserId={user?.uid}
                    />
                  </div>
                );
              })}
            </div>
            
            {hasMore && (
              <div className="flex justify-center mb-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  isLoading={loadingMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-full shadow-sm hover:shadow transition-all duration-200"
                >
                  {loadingMore ? 'Loading...' : 'Load More Tee Times'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
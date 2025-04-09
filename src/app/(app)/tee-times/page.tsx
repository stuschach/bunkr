// src/app/(app)/tee-times/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeCard } from '@/components/tee-times/TeeTimeCard';
import { TeeTimeFiltersComponent } from '@/components/tee-times/TeeTimeFilters';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTime, TeeTimeFilters, UserProfile } from '@/types/tee-times';

export default function TeeTimes() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    error, 
    getPublicTeeTimesList, 
    getUserProfile,
    joinTeeTime 
  } = useTeeTime();
  
  // State
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [creators, setCreators] = useState<{[key: string]: UserProfile | null}>({});
  const [filters, setFilters] = useState<TeeTimeFilters>({
    status: 'open',
    date: null,
  });
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [joinRequestLoading, setJoinRequestLoading] = useState<string | null>(null);
  
  // Load tee times
  const fetchTeeTimes = useCallback(async (reset: boolean = false) => {
    try {
      const newFilters = reset ? { status: 'open', date: null } : filters;
      const lastVisibleDoc = reset ? null : lastVisible;
      
      if (reset) {
        setFilters(newFilters);
      }
      
      const result = await getPublicTeeTimesList(newFilters, lastVisibleDoc);
      
      if (reset) {
        setTeeTimes(result.teeTimes);
      } else {
        setTeeTimes(prev => [...prev, ...result.teeTimes]);
      }
      
      setLastVisible(result.lastVisible);
      setHasMore(result.teeTimes.length === 10); // Assuming 10 is the page size
      
      // Fetch creator profiles
      const creatorIds = result.teeTimes.map(teeTime => teeTime.creatorId);
      const uniqueCreatorIds = [...new Set(creatorIds)];
      
      const creatorProfiles: {[key: string]: UserProfile | null} = {};
      await Promise.all(
        uniqueCreatorIds.map(async (creatorId) => {
          if (!creators[creatorId]) {
            const profile = await getUserProfile(creatorId);
            creatorProfiles[creatorId] = profile;
          }
        })
      );
      
      setCreators(prev => ({ ...prev, ...creatorProfiles }));
      
    } catch (error) {
      console.error('Error fetching tee times:', error);
    }
  }, [filters, lastVisible, getPublicTeeTimesList, getUserProfile, creators]);
  
  // Load initial tee times
  useEffect(() => {
    fetchTeeTimes(true);
  }, []);
  
  // Handle filter changes
  const handleFilterChange = (newFilters: TeeTimeFilters) => {
    setFilters(newFilters);
    fetchTeeTimes(true);
  };
  
  // Handle load more
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await fetchTeeTimes();
    setLoadingMore(false);
  };
  
  // Handle join request
  const handleJoinRequest = async (teeTimeId: string) => {
    if (!user) {
      router.push('/login?returnUrl=/tee-times');
      return;
    }
    
    setJoinRequestLoading(teeTimeId);
    
    try {
      const success = await joinTeeTime(teeTimeId);
      
      if (success) {
        // Update the tee time in the list to show as joined
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
                }
              ]
            };
          }
          return teeTime;
        }));
      }
    } catch (error) {
      console.error('Error joining tee time:', error);
    } finally {
      setJoinRequestLoading(null);
    }
  };

  // Navigate to create tee time
  const handleCreateTeeTime = () => {
    router.push('/tee-times/create');
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <Heading level={2} className="mb-2">Tee Times</Heading>
          <Text className="text-gray-500 dark:text-gray-400">
            Find and join group tee times or create your own
          </Text>
        </div>
        
        <Button
          className="mt-4 md:mt-0"
          onClick={handleCreateTeeTime}
        >
          Create Tee Time
        </Button>
      </div>
      
      <TeeTimeFiltersComponent 
        onFilterChange={handleFilterChange}
        initialFilters={filters}
      />
      
      {isLoading && teeTimes.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" color="primary" label="Loading tee times..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 text-center">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => fetchTeeTimes(true)}
          >
            Try Again
          </Button>
        </div>
      ) : teeTimes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Text className="text-gray-500 dark:text-gray-400 mb-4">
            No tee times found matching your filters
          </Text>
          <Button 
            variant="outline" 
            onClick={() => fetchTeeTimes(true)}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {teeTimes.map(teeTime => (
              <TeeTimeCard
                key={teeTime.id}
                teeTime={teeTime}
                creator={creators[teeTime.creatorId] || undefined}
                onJoinRequest={handleJoinRequest}
                currentUserId={user?.uid}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center mb-8">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                isLoading={loadingMore}
                disabled={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
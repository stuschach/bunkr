// src/app/(app)/tee-times/my/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeCard } from '@/components/tee-times/TeeTimeCard';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTime } from '@/types/tee-times';

export default function MyTeeTimes() {
  const router = useRouter();
  const { user } = useAuth();
  const { isLoading, error, getUserTeeTimes, getUserProfile } = useTeeTime();
  
  // State
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<{[key: string]: any}>({});
  const [activeTab, setActiveTab] = useState('upcoming');
  
  // Load tee times
  const fetchTeeTimes = useCallback(async () => {
    if (!user) return;
    
    try {
      const teeTimesList = await getUserTeeTimes();
      setTeeTimes(teeTimesList);
      
      // Fetch creator profiles for all tee times
      const creatorIds = teeTimesList
        .map(teeTime => teeTime.creatorId)
        .filter(id => id !== user.uid); // Skip current user
      
      const uniqueCreatorIds = [...new Set(creatorIds)];
      
      const profiles: {[key: string]: any} = {};
      await Promise.all(
        uniqueCreatorIds.map(async (creatorId) => {
          const profile = await getUserProfile(creatorId);
          if (profile) {
            profiles[creatorId] = profile;
          }
        })
      );
      
      setCreatorProfiles(profiles);
    } catch (error) {
      console.error('Error fetching tee times:', error);
    }
  }, [user, getUserTeeTimes, getUserProfile]);
  
  // Load initial data
  useEffect(() => {
    if (user) {
      fetchTeeTimes();
    }
  }, [user, fetchTeeTimes]);
  
  // Filter tee times based on active tab
  const filteredTeeTimes = teeTimes.filter(teeTime => {
    const teeTimeDate = new Date(teeTime.dateTime as Date);
    const isPastTeeTime = isPast(teeTimeDate);
    
    if (activeTab === 'upcoming') {
      return !isPastTeeTime && teeTime.status !== 'cancelled';
    } else if (activeTab === 'past') {
      return isPastTeeTime || teeTime.status === 'cancelled';
    } else if (activeTab === 'hosting') {
      return teeTime.creatorId === user?.uid;
    }
    
    return true;
  });
  
  // Navigate to create tee time
  const handleCreateTeeTime = () => {
    router.push('/tee-times/create');
  };
  
  // Loading state
  if (isLoading && teeTimes.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading your tee times..." />
      </div>
    );
  }
  
  // Check if user is authenticated
  if (!user) {
    router.push('/login?returnUrl=/tee-times/my');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <Heading level={2} className="mb-2">My Tee Times</Heading>
          <Text className="text-gray-500 dark:text-gray-400">
            Manage all your golf tee times
          </Text>
        </div>
        
        <Button
          className="mt-4 md:mt-0"
          onClick={handleCreateTeeTime}
        >
          Create New Tee Time
        </Button>
      </div>
      
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 text-center">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={fetchTeeTimes}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <Tabs
          tabs={[
            {
              id: 'upcoming',
              label: 'Upcoming',
              content: (
                <div>
                  {filteredTeeTimes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTeeTimes.map(teeTime => (
                        <TeeTimeCard
                          key={teeTime.id}
                          teeTime={teeTime}
                          creator={
                            teeTime.creatorId === user.uid
                              ? {
                                  uid: user.uid,
                                  displayName: user.displayName,
                                  photoURL: user.photoURL,
                                  email: user.email
                                }
                              : creatorProfiles[teeTime.creatorId]
                          }
                          currentUserId={user.uid}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Text className="text-gray-500 dark:text-gray-400 mb-4">
                        You don't have any upcoming tee times
                      </Text>
                      <Button 
                        onClick={handleCreateTeeTime}
                      >
                        Create Your First Tee Time
                      </Button>
                    </div>
                  )}
                </div>
              )
            },
            {
              id: 'hosting',
              label: 'Hosting',
              content: (
                <div>
                  {filteredTeeTimes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTeeTimes.map(teeTime => (
                        <TeeTimeCard
                          key={teeTime.id}
                          teeTime={teeTime}
                          creator={{
                            uid: user.uid,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            email: user.email
                          }}
                          currentUserId={user.uid}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Text className="text-gray-500 dark:text-gray-400 mb-4">
                        You're not hosting any tee times yet
                      </Text>
                      <Button 
                        onClick={handleCreateTeeTime}
                      >
                        Host a Tee Time
                      </Button>
                    </div>
                  )}
                </div>
              )
            },
            {
              id: 'past',
              label: 'Past',
              content: (
                <div>
                  {filteredTeeTimes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTeeTimes.map(teeTime => (
                        <TeeTimeCard
                          key={teeTime.id}
                          teeTime={teeTime}
                          creator={
                            teeTime.creatorId === user.uid
                              ? {
                                  uid: user.uid,
                                  displayName: user.displayName,
                                  photoURL: user.photoURL,
                                  email: user.email
                                }
                              : creatorProfiles[teeTime.creatorId]
                          }
                          currentUserId={user.uid}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Text className="text-gray-500 dark:text-gray-400">
                        No past tee times found
                      </Text>
                    </div>
                  )}
                </div>
              )
            }
          ]}
          defaultTab="upcoming"
          onChange={setActiveTab}
          variant="underline"
        />
      )}
    </div>
  );
}
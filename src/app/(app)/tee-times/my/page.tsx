// src/app/(app)/tee-times/my/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, formatDistance } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeCard } from '@/components/tee-times/TeeTimeCard';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TeeTime, UserProfile } from '@/types/tee-times';
import { Check, X, Users, InfoIcon, Clock, Calendar } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { DocumentSnapshot } from 'firebase/firestore';

// Define window interface extension for toast function
declare global {
  interface Window {
    showToast?: (options: { 
      title: string; 
      description: string; 
      variant: 'success' | 'error' | 'info' | 'warning' 
    }) => void;
  }
}

export default function MyTeeTimes() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    error, 
    getUserTeeTimes, 
    getUserProfile,
    getUsersByIds, // Import the batch loading function
    respondToInvitation 
  } = useTeeTime();
  
  // State
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, UserProfile>>({});
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'hosting'>('upcoming');
  const [initialLoading, setInitialLoading] = useState(true);
  const [respondingInvitations, setRespondingInvitations] = useState<Record<string, boolean>>({});
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Load tee times with optimized profile fetching
  const fetchTeeTimes = useCallback(async (reset: boolean = false) => {
    if (!user) return;
    
    try {
      setInitialLoading(reset);
      if (reset) setLoadingMore(false);
      else setLoadingMore(true);
      
      // Reset pagination if needed
      const currentLastVisible = reset ? null : lastVisible;
      
      // Get paginated tee times - FIXED to handle pagination properly
      const { teeTimes: teeTimesList, lastVisible: newLastVisible } = 
        await getUserTeeTimes({
          lastVisible: currentLastVisible,
          pageSize: 10
        });
      
      // Update state based on whether we're resetting or loading more
      if (reset) {
        setTeeTimes(teeTimesList);
      } else {
        setTeeTimes(prev => [...prev, ...teeTimesList]);
      }
      
      // Update pagination state
      setLastVisible(newLastVisible);
      setHasMore(!!newLastVisible && teeTimesList.length > 0);
      
      // Fetch creator profiles for all tee times in batch
      const creatorIds = teeTimesList
        .map(teeTime => teeTime.creatorId)
        .filter((id): id is string => id !== undefined && id !== user.uid);
      
      if (creatorIds.length > 0) {
        const uniqueCreatorIds = [...new Set(creatorIds)];
        
        // OPTIMIZED: Use batch loading instead of individual requests
        const profiles = await getUsersByIds(uniqueCreatorIds);
        
        // Convert returned map to the expected format
        const formattedProfiles: Record<string, UserProfile> = {};
        Object.entries(profiles).forEach(([id, profile]) => {
          if (profile) {
            formattedProfiles[id] = profile;
          }
        });
        
        setCreatorProfiles(prev => ({ ...prev, ...formattedProfiles }));
      }
    } catch (error) {
      console.error('Error fetching tee times:', error);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [user, getUserTeeTimes, getUsersByIds, lastVisible]);
  
  // Load initial data
  useEffect(() => {
    if (user) {
      fetchTeeTimes(true);
    }
  }, [user, fetchTeeTimes]);
  
  // Handle load more
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    await fetchTeeTimes(false);
  };
  
  // Filter tee times based on active tab
  const filteredTeeTimes = teeTimes.filter(teeTime => {
    const teeTimeDate = new Date(teeTime.dateTime || Date.now());
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
  
  // Filter for pending invitations
  const pendingInvitations = teeTimes.filter(teeTime => {
    const playerData = teeTime.players?.find(p => p.userId === user?.uid);
    return playerData?.status === 'pending' && playerData?.requestType === 'invitation';
  });
  
  // Navigate to create tee time
  const handleCreateTeeTime = () => {
    router.push('/tee-times/create');
  };
  
  // Handle accept invitation
  const handleAcceptInvitation = async (teeTimeId: string) => {
    if (!user) return;
    
    setRespondingInvitations(prev => ({ ...prev, [teeTimeId]: true }));
    
    try {
      await respondToInvitation(teeTimeId, user.uid, 'accept');
      
      // Optimistically update the UI
      setTeeTimes(prev => prev.map(teeTime => {
        if (teeTime.id === teeTimeId) {
          // Update the player status
          const updatedPlayers = teeTime.players?.map(player => {
            if (player.userId === user.uid) {
              return { ...player, status: 'confirmed' };
            }
            return player;
          }) || [];
          
          return {
            ...teeTime,
            players: updatedPlayers,
            currentPlayers: (teeTime.currentPlayers || 1) + 1
          };
        }
        return teeTime;
      }));
      
      // Show success message
      if (window.showToast) {
        window.showToast({
          title: 'Invitation Accepted',
          description: 'You have joined the tee time',
          variant: 'success'
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      
      if (window.showToast) {
        window.showToast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to accept invitation',
          variant: 'error'
        });
      }
    } finally {
      setRespondingInvitations(prev => ({ ...prev, [teeTimeId]: false }));
    }
  };
  
  // Handle decline invitation
  const handleDeclineInvitation = async (teeTimeId: string) => {
    if (!user) return;
    
    setRespondingInvitations(prev => ({ ...prev, [teeTimeId]: true }));
    
    try {
      await respondToInvitation(teeTimeId, user.uid, 'decline');
      
      // Optimistically update the UI
      setTeeTimes(prev => prev.map(teeTime => {
        if (teeTime.id === teeTimeId) {
          // Update the player status
          const updatedPlayers = teeTime.players?.map(player => {
            if (player.userId === user.uid) {
              return { ...player, status: 'declined' };
            }
            return player;
          }) || [];
          
          return {
            ...teeTime,
            players: updatedPlayers
          };
        }
        return teeTime;
      }));
      
      // Show success message
      if (window.showToast) {
        window.showToast({
          title: 'Invitation Declined',
          description: 'You have declined the tee time invitation',
          variant: 'info'
        });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      
      if (window.showToast) {
        window.showToast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to decline invitation',
          variant: 'error'
        });
      }
    } finally {
      setRespondingInvitations(prev => ({ ...prev, [teeTimeId]: false }));
    }
  };
  
  // Loading state
  if (initialLoading) {
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

  // Define a consistent user profile type to pass to TeeTimeCard
  const currentUserProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || '',
    photoURL: user.photoURL || null,
    email: user.email || '',
    createdAt: new Date(),
    handicapIndex: 0,
    homeCourse: null,
    profileComplete: true
  };

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
      
      {error && (
        <Card className="mb-6 border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <Text className="text-red-600 dark:text-red-400 font-medium">
              {error instanceof Error ? error.message : String(error)}
            </Text>
            <div className="mt-2">
              <Button 
                variant="outline" 
                onClick={() => fetchTeeTimes(true)}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Pending Invitations Section with Enhanced UI */}
      {pendingInvitations.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Heading level={3} className="text-xl">Pending Invitations</Heading>
              <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                {pendingInvitations.length}
              </Badge>
              <Tooltip content="These are tee times you've been invited to join. Accept to confirm your spot, or decline to remove the invitation.">
                <InfoIcon className="w-4 h-4 ml-2 text-gray-500 cursor-help" />
              </Tooltip>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingInvitations.map(teeTime => {
              const inviter = creatorProfiles[teeTime.creatorId];
              const playerData = teeTime.players?.find(p => p.userId === user?.uid);
              const invitedAt = playerData?.joinedAt ? new Date(playerData.joinedAt) : new Date();
              const timeAgo = formatDistance(invitedAt, new Date(), { addSuffix: true });
              
              return (
                <div key={teeTime.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">{teeTime.courseName}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Invitation
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div className="flex items-center mb-1">
                        <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{teeTime.dateTime && format(new Date(teeTime.dateTime), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center mb-1">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{teeTime.dateTime && format(new Date(teeTime.dateTime), 'h:mm a')}</span>
                      </div>
                      <div className="flex items-center mb-1">
                        <Users className="h-4 w-4 mr-2 text-gray-500" />
                        <span>{teeTime.currentPlayers}/{teeTime.maxPlayers} players</span>
                      </div>
                    </div>
                    
                    <div className="text-sm mb-4">
                      <div className="flex items-center text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Invited by:</span>
                        <span className="ml-2">{inviter?.displayName || 'Unknown Host'}</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                        <span>Invited {timeAgo}</span>
                      </div>
                    </div>
                    
                    {teeTime.description && (
                      <div className="mt-3 text-gray-600 dark:text-gray-300 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                        {teeTime.description}
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-3 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => handleDeclineInvitation(teeTime.id)}
                        isLoading={respondingInvitations[teeTime.id]}
                        disabled={respondingInvitations[teeTime.id]}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      <Button
                        onClick={() => handleAcceptInvitation(teeTime.id)}
                        isLoading={respondingInvitations[teeTime.id]}
                        disabled={respondingInvitations[teeTime.id]}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <Tabs
        tabs={[
          {
            id: 'upcoming',
            label: <>
              Upcoming
              {filteredTeeTimes.length > 0 && activeTab !== 'upcoming' && (
                <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                  {filteredTeeTimes.length}
                </Badge>
              )}
            </>,
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
                            ? currentUserProfile
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
                
                {hasMore && filteredTeeTimes.length > 0 && (
                  <div className="flex justify-center mt-6">
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
              </div>
            )
          },
          {
            id: 'hosting',
            label: <>
              Hosting
              {filteredTeeTimes.length > 0 && activeTab !== 'hosting' && (
                <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  {filteredTeeTimes.length}
                </Badge>
              )}
            </>,
            content: (
              <div>
                {filteredTeeTimes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTeeTimes.map(teeTime => (
                      <TeeTimeCard
                        key={teeTime.id}
                        teeTime={teeTime}
                        creator={currentUserProfile}
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
                
                {hasMore && filteredTeeTimes.length > 0 && (
                  <div className="flex justify-center mt-6">
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
              </div>
            )
          },
          {
            id: 'past',
            label: <>
              Past
              {filteredTeeTimes.length > 0 && activeTab !== 'past' && (
                <Badge className="ml-2 bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300">
                  {filteredTeeTimes.length}
                </Badge>
              )}
            </>,
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
                            ? currentUserProfile
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
                
                {hasMore && filteredTeeTimes.length > 0 && (
                  <div className="flex justify-center mt-6">
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
              </div>
            )
          }
        ]}
        defaultTab="upcoming"
        onChange={(tab) => setActiveTab(tab as 'upcoming' | 'past' | 'hosting')}
        variant="underline"
      />
    </div>
  );
}
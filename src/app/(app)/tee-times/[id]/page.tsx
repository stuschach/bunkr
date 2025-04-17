// src/app/(app)/tee-times/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistance } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useToast } from '@/lib/hooks/useToast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTimePlayersList } from '@/components/tee-times/TeeTimePlayersList';
import { TeeTime, TeeTimePlayer } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { 
  InfoIcon, 
  Bell, 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UsersIcon,
  AlertTriangle 
} from 'lucide-react';

// New component: Activity Feed for tee time 
const TeeTimeActivityFeed = ({ activities }: { activities: {
  type: string;
  actor: string;
  timestamp: Date;
  message: string;
}[] }) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mr-3 flex-shrink-0">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{activity.message}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDistance(activity.timestamp, new Date(), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// New component: Bulk Invite Modal
const BulkInviteModal = ({ isOpen, onClose, onInvite, teeTimeId }: {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (userIds: string[]) => Promise<void>;
  teeTimeId: string;
}) => {
  const { searchUsers } = useTeeTime();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  
  // Search for users
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Toggle user selection
  const toggleUserSelection = (user: UserProfile) => {
    if (selectedUsers.some(u => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter(u => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };
  
  // Handle bulk invite
  const handleBulkInvite = async () => {
    if (selectedUsers.length === 0) return;
    
    setIsInviting(true);
    try {
      await onInvite(selectedUsers.map(u => u.uid));
      onClose();
    } catch (error) {
      console.error('Error inviting users:', error);
    } finally {
      setIsInviting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Invite Multiple Friends</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Friends
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent focus:ring-2 focus:ring-green-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Results
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery.length < 2 ? 'Type to search for friends' : 'No results found'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {searchResults.map(user => (
                    <div
                      key={user.uid}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        selectedUsers.some(u => u.uid === user.uid) ? 'bg-green-50 dark:bg-green-900/20' : ''
                      }`}
                      onClick={() => toggleUserSelection(user)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.some(u => u.uid === user.uid)}
                        onChange={() => {}}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 mr-2"
                      />
                      <div className="flex-grow">
                        <div className="font-medium">{user.displayName || 'Unknown User'}</div>
                        {user.homeCourse && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">Home: {user.homeCourse}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Selected Friends ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-gray-200 dark:border-gray-700 rounded-md">
              {selectedUsers.map(user => (
                <Badge 
                  key={user.uid}
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center"
                >
                  {user.displayName || 'Unknown User'}
                  <button 
                    className="ml-1.5 hover:text-red-500 dark:hover:text-red-400"
                    onClick={() => toggleUserSelection(user)}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
              {selectedUsers.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No friends selected
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isInviting}>
          Cancel
        </Button>
        <Button 
          onClick={handleBulkInvite} 
          disabled={selectedUsers.length === 0 || isInviting}
          isLoading={isInviting}
        >
          Invite {selectedUsers.length} {selectedUsers.length === 1 ? 'Friend' : 'Friends'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default function TeeTimeDetails() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const notificationCreator = useNotificationCreator();
  
  const { 
    isLoading, 
    error,
    getTeeTimeDetails,
    subscribeTeeTime,
    subscribeTeeTimePlayers,
    joinTeeTime,
    cancelTeeTime,
    approvePlayer,
    removePlayer,
    invitePlayer,
    searchUsers,
    getUserProfile,
    pendingOperations
  } = useTeeTime();
  
  // State
  const [teeTime, setTeeTime] = useState<TeeTime | null>(null);
  const [players, setPlayers] = useState<(TeeTimePlayer & { profile?: UserProfile })[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showBulkInviteDialog, setShowBulkInviteDialog] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState<Record<string, boolean>>({});
  const [activities, setActivities] = useState<{
    type: string;
    actor: string;
    timestamp: Date;
    message: string;
  }[]>([]);
  
  // Get the tee time ID from params
  const teeTimeId = params.id as string;
  
  // Check if the current user is the creator
  const isCreator = user && teeTime && user.uid === teeTime.creatorId;
  
  // Check if the current user is a player
  const isPlayer = user && players.some(
    player => player.userId === user.uid && player.status === 'confirmed'
  );
  
  // Check if the current user has a pending request
  const hasPendingRequest = user && players.some(
    player => player.userId === user.uid && player.status === 'pending'
  );
  
  // Check if the current user was invited
  const wasInvited = user && players.some(
    player => player.userId === user.uid && 
              player.status === 'pending' && 
              player.requestType === 'invitation'
  );
  
  // Check if operations are pending
  const isJoining = pendingOperations[`join_${teeTimeId}`];
  const isCancelling = pendingOperations[`cancel_${teeTimeId}`];
  
  // Memoized helper function to fetch profiles for players that need them
  const fetchMissingProfiles = useCallback(async (playerList: TeeTimePlayer[]) => {
    // Find players without profiles that aren't currently loading
    const playersNeedingProfiles = playerList.filter(player => {
      const existingPlayer = players.find(p => p.userId === player.userId);
      return !existingPlayer?.profile && !loadingProfiles[player.userId];
    });
    
    if (playersNeedingProfiles.length === 0) return;
    
    // Update loading state for these players
    const newLoadingState: Record<string, boolean> = {};
    playersNeedingProfiles.forEach(player => {
      newLoadingState[player.userId] = true;
    });
    
    if (Object.keys(newLoadingState).length > 0) {
      setLoadingProfiles(prev => ({ ...prev, ...newLoadingState }));
    }
    
    // Fetch profiles and update player data
    const updatedProfiles: Record<string, UserProfile> = {};
    
    try {
      // Fetch each profile sequentially to avoid rate limits
      for (const player of playersNeedingProfiles) {
        try {
          const profile = await getUserProfile(player.userId);
          if (profile) {
            updatedProfiles[player.userId] = profile;
          }
        } catch (err) {
          console.error(`Error fetching profile for ${player.userId}:`, err);
        } finally {
          // Mark this player's profile as no longer loading
          setLoadingProfiles(prev => ({ ...prev, [player.userId]: false }));
        }
      }
      
      // Only update players state if we have new profiles
      if (Object.keys(updatedProfiles).length > 0) {
        setPlayers(prevPlayers => 
          prevPlayers.map(player => {
            if (updatedProfiles[player.userId]) {
              return {
                ...player,
                profile: updatedProfiles[player.userId]
              };
            }
            return player;
          })
        );
      }
    } catch (error) {
      console.error('Error fetching player profiles:', error);
    }
  }, [getUserProfile, players, loadingProfiles]);
  
  // Effect for initial data loading and setting up subscriptions
  useEffect(() => {
    let isMounted = true;
    
    // Initial load
    const loadTeeTimeDetails = async () => {
      try {
        const result = await getTeeTimeDetails(teeTimeId);
        
        if (!isMounted) return;
        
        setTeeTime(result.teeTime);
        setPlayers(result.players);
        
        // Generate initial activity feed
        if (result.players.length > 0) {
          const newActivities = result.players
            .filter(p => p.joinedAt)
            .map(player => {
              const requestType = player.requestType || 'joined';
              let message = '';
              
              if (requestType === 'invitation') {
                message = `${player.profile?.displayName || 'Someone'} was invited`;
              } else if (requestType === 'join_request') {
                message = `${player.profile?.displayName || 'Someone'} requested to join`;
              } else if (requestType === 'creator') {
                message = `${player.profile?.displayName || 'Someone'} created this tee time`;
              }
              
              return {
                type: requestType,
                actor: player.userId,
                timestamp: new Date(player.joinedAt),
                message
              };
            })
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);
            
          setActivities(newActivities);
        }
      } catch (error) {
        console.error('Error loading tee time details:', error);
      }
    };
    
    loadTeeTimeDetails();
    
    // Set up subscriptions for real-time updates
    const unsubscribeTeeTime = subscribeTeeTime(teeTimeId, (updatedTeeTime) => {
      if (!isMounted) return;
      
      if (updatedTeeTime) {
        setTeeTime(updatedTeeTime);
      }
    });
    
    // Subscribe to player updates
    const unsubscribePlayers = subscribeTeeTimePlayers(teeTimeId, (updatedPlayers) => {
      if (!isMounted) return;
      
      // Combine players with existing profiles
      const playersWithProfiles = updatedPlayers.map(player => {
        // Check if we have the profile in existing state
        const existingPlayer = players.find(p => p.userId === player.userId);
        if (existingPlayer?.profile) {
          return {
            ...player,
            profile: existingPlayer.profile
          };
        }
        
        // Otherwise return player without profile
        return player;
      });
      
      // Update state with what we have
      setPlayers(playersWithProfiles);
      
      // Check for new activities
      if (playersWithProfiles.length > players.length) {
        const newPlayers = playersWithProfiles.filter(
          p => !players.some(existingP => existingP.userId === p.userId)
        );
        
        if (newPlayers.length > 0) {
          const newActivities = newPlayers.map(player => ({
            type: player.requestType || 'joined',
            actor: player.userId,
            timestamp: new Date(),
            message: `${player.profile?.displayName || 'Someone'} ${
              player.requestType === 'invitation' 
                ? 'was invited' 
                : 'requested to join'
            }`
          }));
          
          setActivities(prev => [...newActivities, ...prev].slice(0, 20));
        }
      }
    });
    
    // Clean up subscriptions
    return () => {
      isMounted = false;
      unsubscribeTeeTime();
      unsubscribePlayers();
    };
  }, [teeTimeId, getTeeTimeDetails, subscribeTeeTime, subscribeTeeTimePlayers]);
  
  // Separate effect to fetch missing profiles
  useEffect(() => {
    // Skip if no players or we're still loading the tee time
    if (players.length === 0 || !teeTime) return;
    
    // Create a separate async function to fetch profiles
    const loadProfiles = async () => {
      await fetchMissingProfiles(players);
    };
    
    loadProfiles();
  }, [teeTime, players, fetchMissingProfiles]);
  
  // Handle join request with notification for creator
  const handleJoinRequest = async () => {
    if (!user) {
      router.push(`/login?returnUrl=/tee-times/${teeTimeId}`);
      return;
    }
    
    try {
      // Join the tee time (this will add the player to the tee time)
      const success = await joinTeeTime(teeTimeId);
      
      if (success && teeTime) {
        // Send notification to the tee time creator
        await notificationCreator.notifyTeeTimeRequest(
          teeTime.creatorId,
          teeTimeId,
          teeTime.courseName,
          teeTime.dateTime || new Date()
        );
        
        showToast({
          title: 'Request sent',
          description: 'Your request to join has been sent to the host',
          variant: 'success'
        });
        
        // Add to activity feed
        setActivities(prev => [{
          type: 'join_request',
          actor: user.uid,
          timestamp: new Date(),
          message: `${user.displayName || 'You'} requested to join`
        }, ...prev].slice(0, 20));
      }
    } catch (error) {
      console.error('Error joining tee time:', error);
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join tee time',
        variant: 'error'
      });
    }
  };
  
  // Handle approving a player's join request
  const handleApprovePlayer = async (playerId: string) => {
    if (!user || !teeTime) return false;
    
    try {
      const success = await approvePlayer(teeTimeId, playerId);
      
      if (success) {
        // Get the player profile
        const playerProfile = players.find(p => p.userId === playerId)?.profile;
        
        showToast({
          title: 'Player approved',
          description: `${playerProfile?.displayName || 'Player'} has been added to your tee time`,
          variant: 'success'
        });
        
        // Send notification to the approved player
        await notificationCreator.notifyTeeTimeApproved(
          playerId,
          teeTimeId,
          teeTime.courseName,
          teeTime.dateTime || new Date()
        );
        
        // Add to activity feed
        setActivities(prev => [{
          type: 'approve',
          actor: user.uid,
          timestamp: new Date(),
          message: `${playerProfile?.displayName || 'A player'} was approved to join`
        }, ...prev].slice(0, 20));
      }
      
      return success;
    } catch (error) {
      console.error('Error approving player:', error);
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve player',
        variant: 'error'
      });
      
      return false;
    }
  };
  
  // Handle removing a player from the tee time
  const handleRemovePlayer = async (playerId: string) => {
    if (!user || !teeTime) return false;
    
    try {
      const success = await removePlayer(teeTimeId, playerId);
      
      if (success) {
        const playerProfile = players.find(p => p.userId === playerId)?.profile;
        
        showToast({
          title: 'Player removed',
          description: `${playerProfile?.displayName || 'Player'} has been removed from your tee time`,
          variant: 'success'
        });
        
        // Add to activity feed
        setActivities(prev => [{
          type: 'remove',
          actor: user.uid,
          timestamp: new Date(),
          message: `${playerProfile?.displayName || 'A player'} was removed from the tee time`
        }, ...prev].slice(0, 20));
      }
      
      return success;
    } catch (error) {
      console.error('Error removing player:', error);
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove player',
        variant: 'error'
      });
      
      return false;
    }
  };
  
  // Handle cancelling a tee time
  const handleCancelTeeTime = async () => {
    try {
      const success = await cancelTeeTime(teeTimeId);
      
      if (success) {
        setShowCancelDialog(false);
        
        // Show success message
        showToast({
          title: 'Tee time cancelled',
          description: 'Your tee time has been cancelled',
          variant: 'success'
        });
        
        // Optional: Send notification to all confirmed players
        if (teeTime) {
          const confirmedPlayers = players.filter(p => 
            p.status === 'confirmed' && p.userId !== user?.uid
          );
          
          // Send notifications to all confirmed players
          await Promise.all(confirmedPlayers.map(player =>
            notificationCreator.sendNotification(
              player.userId,
              'tee-time-cancelled',
              teeTimeId,
              'tee-time',
              {
                courseName: teeTime.courseName,
                date: teeTime.dateTime instanceof Date 
                  ? teeTime.dateTime.toISOString() 
                  : new Date(teeTime.dateTime || Date.now()).toISOString()
              },
              'high'
            )
          ));
          
          // Add to activity feed
          setActivities(prev => [{
            type: 'cancel',
            actor: user?.uid || '',
            timestamp: new Date(),
            message: `${user?.displayName || 'The host'} cancelled this tee time`
          }, ...prev].slice(0, 20));
        }
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel tee time',
        variant: 'error'
      });
    }
  };
  
  // Handle bulk invite
  const handleBulkInvite = async (userIds: string[]) => {
    if (!isCreator || !teeTime) return;
    
    try {
      // Invite each user
      const results = await Promise.all(
        userIds.map(async (userId) => {
          try {
            await invitePlayer(teeTimeId, userId);
            return { userId, success: true };
          } catch (error) {
            return { userId, success: false, error };
          }
        })
      );
      
      const successCount = results.filter(r => r.success).length;
      
      if (successCount > 0) {
        showToast({
          title: 'Players Invited',
          description: `Successfully invited ${successCount} player${successCount !== 1 ? 's' : ''}`,
          variant: 'success'
        });
        
        // Add to activity feed
        setActivities(prev => [{
          type: 'bulk_invite',
          actor: user.uid,
          timestamp: new Date(),
          message: `${user.displayName || 'The host'} invited ${successCount} players`
        }, ...prev].slice(0, 20));
      }
      
      if (successCount < userIds.length) {
        showToast({
          title: 'Some Invitations Failed',
          description: `${userIds.length - successCount} invitation${(userIds.length - successCount) !== 1 ? 's' : ''} could not be sent`,
          variant: 'warning'
        });
      }
    } catch (error) {
      console.error('Error during bulk invite:', error);
      
      showToast({
        title: 'Error',
        description: 'There was a problem sending invitations',
        variant: 'error'
      });
    }
  };
  
  // Format date and time for display
  const formattedDate = teeTime?.dateTime
    ? format(
        typeof teeTime.dateTime === 'string' 
          ? new Date(teeTime.dateTime) 
          : 'toDate' in teeTime.dateTime
            ? teeTime.dateTime.toDate()
            : teeTime.dateTime, 
        'EEEE, MMMM d, yyyy'
      )
    : '';
    
  const formattedTime = teeTime?.dateTime
    ? format(
        typeof teeTime.dateTime === 'string' 
          ? new Date(teeTime.dateTime) 
          : 'toDate' in teeTime.dateTime
            ? teeTime.dateTime.toDate()
            : teeTime.dateTime, 
        'h:mm a'
      )
    : '';
  
  // Get creator profile from players list
  const creatorProfile = teeTime 
    ? players.find(p => p.userId === teeTime.creatorId)?.profile
    : undefined;
  
  // Get status badge
  const getStatusBadge = () => {
    if (!teeTime) return null;
    
    switch (teeTime.status) {
      case 'open':
        return <Badge variant="success">Open</Badge>;
      case 'full':
        return <Badge>Full</Badge>;
      case 'cancelled':
        return <Badge variant="error">Cancelled</Badge>;
      default:
        return null;
    }
  };
  
  // Handle player invitation callback for optimistic UI updates
  const handlePlayerInvited = (newPlayer) => {
    // Add the new player to the players list if not already present
    if (!players.some(p => p.userId === newPlayer.userId)) {
      setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
      
      // Add to activity feed
      setActivities(prev => [{
        type: 'invite',
        actor: user?.uid || '',
        timestamp: new Date(),
        message: `${newPlayer.profile?.displayName || 'Someone'} was invited`
      }, ...prev].slice(0, 20));
    }
  };
  
  // Calculate pending requests count
  const pendingRequestsCount = players.filter(
    p => p.status === 'pending' && 
    (!p.requestType || p.requestType === 'join_request')
  ).length;
  
  // Calculate pending invitations count
  const pendingInvitationsCount = players.filter(
    p => p.status === 'pending' && p.requestType === 'invitation'
  ).length;
  
  // Loading state
  if (isLoading && !teeTime) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading tee time details..." />
      </div>
    );
  }
  
  // Error state
  if (error || !teeTime) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-lg text-center">
          <Heading level={3} className="text-red-600 dark:text-red-400 mb-4">
            {error instanceof Error ? error.message : 'Tee time not found'}
          </Heading>
          <Button onClick={() => router.push('/tee-times')}>
            Back to Tee Times
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Button
            variant="outline"
            className="mb-4 md:mb-0"
            onClick={() => router.push('/tee-times')}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tee Times
          </Button>
        </div>
        
        {isCreator && teeTime.status !== 'cancelled' && (
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/tee-times/${teeTimeId}/edit`)}
            >
              Edit Tee Time
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              isLoading={isCancelling}
              disabled={isCancelling}
            >
              Cancel Tee Time
            </Button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{teeTime.courseName}</CardTitle>
                  <div className="text-gray-500 dark:text-gray-400 mt-1">
                    {formattedDate} at {formattedTime}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {getStatusBadge()}
                  {teeTime.visibility !== 'public' && (
                    <Badge variant="outline">
                      {teeTime.visibility === 'followers' ? 'Followers Only' : 'Private'}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {teeTime.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {teeTime.description}
                  </p>
                </div>
              )}
              
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <UsersIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Group Size</div>
                      <div className="font-medium">{teeTime.currentPlayers} / {teeTime.maxPlayers} players</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Date</div>
                      <div className="font-medium">{formattedDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Time</div>
                      <div className="font-medium">{formattedTime}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-5 w-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mr-2">
                      {creatorProfile?.photoURL ? (
                        <img src={creatorProfile.photoURL} alt={creatorProfile.displayName || 'Host'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center text-white text-xs">
                          {creatorProfile?.displayName?.[0] || 'H'}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Created By</div>
                      <div className="font-medium">
                        {creatorProfile?.displayName || (loadingProfiles[teeTime.creatorId] ? 'Loading...' : 'Unknown Host')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Activity Feed Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  Recent Activity
                  <InfoIcon className="h-4 w-4 ml-2 text-gray-500 cursor-help" />
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-md p-4">
                  <TeeTimeActivityFeed activities={activities} />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-gray-200 dark:border-gray-800">
              {!isCreator && !isPlayer && !hasPendingRequest && teeTime.status === 'open' && (
                <Button
                  className="w-full"
                  onClick={handleJoinRequest}
                  isLoading={isJoining}
                  disabled={isJoining}
                >
                  Request to Join
                </Button>
              )}
              
              {hasPendingRequest && (
                <div className="w-full text-center">
                  {wasInvited ? (
                    <div className="flex justify-center space-x-4">
                      <Button 
                        variant="outline"
                        onClick={() => respondToInvitation(teeTimeId, user?.uid || '', 'decline')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline Invitation
                      </Button>
                      <Button
                        onClick={() => respondToInvitation(teeTimeId, user?.uid || '', 'accept')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept Invitation
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="py-2 px-4">
                      Request Pending Approval
                    </Badge>
                  )}
                </div>
              )}
              
              {isPlayer && !isCreator && (
                <div className="w-full text-center">
                  <Badge variant="success" className="py-2 px-4">
                    You've Joined This Tee Time
                  </Badge>
                </div>
              )}
              
              {isCreator && (
                <div className="w-full flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <Badge variant="outline" className="py-2 px-4">
                    You're Hosting This Tee Time
                  </Badge>
                  
                  {teeTime.status === 'open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkInviteDialog(true)}
                      className="self-center"
                    >
                      Invite Multiple Friends
                    </Button>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <TeeTimePlayersList
            teeTime={teeTime}
            players={players}
            isCreator={!!isCreator}
            readOnly={teeTime.status === 'cancelled'}
            onPlayerInvited={handlePlayerInvited}
            onApprovePlayer={handleApprovePlayer}
            onRemovePlayer={handleRemovePlayer}
            pendingRequestsCount={pendingRequestsCount}
            pendingInvitationsCount={pendingInvitationsCount}
          />
        </div>
      </div>
      
      {/* Cancel Tee Time Confirmation Dialog */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Cancel Tee Time</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="flex items-start mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to cancel this tee time? This action cannot be undone
              and all players will be notified.
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-md text-sm text-amber-800 dark:text-amber-300">
            This will send cancellation notifications to {players.filter(p => p.status === 'confirmed' && p.userId !== user?.uid).length} confirmed player(s).
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(false)}
            disabled={isCancelling}
          >
            Keep Tee Time
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancelTeeTime}
            isLoading={isCancelling}
            disabled={isCancelling}
          >
            Cancel Tee Time
          </Button>
        </DialogFooter>
      </Dialog>
      
      {/* Bulk Invite Dialog */}
      <BulkInviteModal 
        isOpen={showBulkInviteDialog}
        onClose={() => setShowBulkInviteDialog(false)}
        onInvite={handleBulkInvite}
        teeTimeId={teeTimeId}
      />
    </div>
  );
}
// src/components/tee-times/TeeTimePlayersList.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { format, formatDistance } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTime, TeeTimePlayer } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/lib/hooks/useToast';
import { Tooltip } from '@/components/ui/Tooltip';
import { 
  Search, 
  UserPlus, 
  X, 
  Check, 
  AlertCircle, 
  User,
  Mail,
  Clock,
  Info
} from 'lucide-react';

interface TeeTimePlayersListProps {
  teeTime: TeeTime;
  players: (TeeTimePlayer & { profile?: UserProfile })[];
  isCreator: boolean;
  onApprovePlayer?: (playerId: string) => Promise<boolean | void>;
  onRemovePlayer?: (playerId: string) => Promise<boolean | void>;
  onInvitePlayer?: (userId: string) => Promise<boolean | void>;
  onSearchUsers?: (query: string) => Promise<UserProfile[]>;
  onPlayerInvited?: (player: TeeTimePlayer & { profile?: UserProfile }) => void;
  readOnly?: boolean;
  pendingRequestsCount?: number;
  pendingInvitationsCount?: number;
}

export function TeeTimePlayersList({
  teeTime,
  players,
  isCreator,
  onApprovePlayer,
  onRemovePlayer,
  onInvitePlayer,
  onSearchUsers,
  onPlayerInvited,
  readOnly = false,
  pendingRequestsCount = 0,
  pendingInvitationsCount = 0
}: TeeTimePlayersListProps) {
  // Use the useUsers hook for better search
  const { searchUsers: searchUsersHook, loading: userLoading, getUserById } = useUsers();
  const { showToast } = useToast();
  
  // State
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [noResultsMessage, setNoResultsMessage] = useState('');
  const [activeTab, setActiveTab] = useState('confirmed');
  
  // Use the tee time context for additional functionality
  const { 
    approvePlayer: contextApprovePlayer,
    removePlayer: contextRemovePlayer,
    invitePlayer: contextInvitePlayer,
    pendingOperations 
  } = useTeeTime();
  
  // Helper to check if an operation is pending
  const isOperationPending = useCallback((type: string, playerId: string) => {
    return !!pendingOperations[`${type}_${teeTime.id}_${playerId}`];
  }, [pendingOperations, teeTime.id]);
  
  // Enhanced search with error handling and minimum character threshold
  const searchUsers = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setNoResultsMessage('');
      return;
    }
    
    try {
      // Show loading state
      setIsSearching(true);
      setNoResultsMessage('');
      
      // Use custom function if provided, otherwise use hook
      const results = onSearchUsers 
        ? await onSearchUsers(query) 
        : await searchUsersHook(query, { maxResults: 20 });
      
      if (!results || results.length === 0) {
        // No results found
        setNoResultsMessage(`No users found matching "${query}"`);
        setSearchResults([]);
        return;
      }
      
      // Filter out users who are already in the tee time
      const filteredResults = results.filter(user => 
        !players.some(player => player.userId === user.uid)
      );
      
      if (filteredResults.length === 0) {
        // All users found are already in the tee time
        setNoResultsMessage(`All users matching "${query}" are already in this tee time`);
      }
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      setNoResultsMessage('An error occurred while searching for users');
    } finally {
      setIsSearching(false);
    }
  }, [onSearchUsers, searchUsersHook, players]);
  
  // Handle user selection
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setInviteError('');
  };
  
  // Handle invite submission with improved feedback
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      setInviteError('Please select a user to invite');
      return;
    }
    
    setIsInviting(true);
    setInviteError('');
    
    try {
      // Use custom function if provided, otherwise use context
      const success = onInvitePlayer 
        ? await onInvitePlayer(selectedUser.uid) 
        : await contextInvitePlayer(teeTime.id, selectedUser.uid);
      
      if (success) {
        // Optimistically update the UI to show the invited player
        const newPlayer: TeeTimePlayer & { profile?: UserProfile } = {
          userId: selectedUser.uid,
          status: 'pending',
          joinedAt: new Date(),
          invitedBy: teeTime.creatorId,
          requestType: 'invitation',
          profile: selectedUser
        };
        
        // Notify parent component about the new player
        if (onPlayerInvited) {
          onPlayerInvited(newPlayer);
        }
        
        // Reset form
        setSearchQuery('');
        setSelectedUser(null);
        setSearchResults([]);
        setShowInviteDialog(false);
        
        // Show success message
        showToast?.({
          title: 'Player invited',
          description: `${selectedUser.displayName} has been invited to your tee time`,
          variant: 'success'
        });
      } else {
        setInviteError('Failed to send invitation. Please try again.');
      }
    } catch (error) {
      console.error('Error inviting player:', error);
      setInviteError(error instanceof Error ? error.message : 'Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };
  
  // Handle approve player
  const handleApprovePlayer = async (playerId: string) => {
    try {
      // Use custom function if provided, otherwise use context
      const success = onApprovePlayer 
        ? await onApprovePlayer(playerId) 
        : await contextApprovePlayer(teeTime.id, playerId);
      
      if (success && showToast) {
        const playerProfile = players.find(p => p.userId === playerId)?.profile;
        showToast({
          title: 'Player approved',
          description: `${playerProfile?.displayName || 'Player'} has been added to your tee time`,
          variant: 'success'
        });
      }
      
      return !!success;
    } catch (error) {
      console.error('Error approving player:', error);
      if (showToast) {
        showToast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to approve player',
          variant: 'error'
        });
      }
      return false;
    }
  };
  
  // Handle remove player
  const handleRemovePlayer = async (playerId: string) => {
    try {
      // Use custom function if provided, otherwise use context
      const success = onRemovePlayer 
        ? await onRemovePlayer(playerId) 
        : await contextRemovePlayer(teeTime.id, playerId);
      
      if (success && showToast) {
        const playerProfile = players.find(p => p.userId === playerId)?.profile;
        showToast({
          title: 'Player removed',
          description: `${playerProfile?.displayName || 'Player'} has been removed from your tee time`,
          variant: 'success'
        });
      }
      
      return !!success;
    } catch (error) {
      console.error('Error removing player:', error);
      if (showToast) {
        showToast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to remove player',
          variant: 'error'
        });
      }
      return false;
    }
  };
  
  // Update search results when query changes (with debounce)
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
        setNoResultsMessage('');
      }
    }, 300);
    
    return () => clearTimeout(delaySearch);
  }, [searchQuery, searchUsers]);
  
  // Track which players we've attempted to load profiles for
  const profileFetchAttemptsRef = useRef<Record<string, boolean>>({});
  
  // Fetch any missing profiles
  useEffect(() => {
    const fetchMissingProfiles = async () => {
      // Get players without profiles, excluding those we've already tried to fetch
      const playersWithoutProfiles = players.filter(p => 
        !p.profile && !profileFetchAttemptsRef.current[p.userId]
      );
      
      if (playersWithoutProfiles.length === 0) return;
      
      // Mark these players as attempted
      playersWithoutProfiles.forEach(p => {
        profileFetchAttemptsRef.current[p.userId] = true;
      });
      
      // Use batch loading for all profiles at once
      const userIds = playersWithoutProfiles.map(p => p.userId);
      if (userIds.length > 0) {
        await getUserById(...userIds);
      }
    };
    
    fetchMissingProfiles();
  }, [players, getUserById]);
  
  // Group players by status and type
  const confirmedPlayers = players.filter(p => p.status === 'confirmed');
  
  // FIXED: Separate invitations from join requests
  const invitedPlayers = players.filter(p => 
    p.status === 'pending' && p.requestType === 'invitation'
  );
  
  const joinRequestPlayers = players.filter(p => 
    p.status === 'pending' && (!p.requestType || p.requestType === 'join_request')
  );
  
  const declinedPlayers = players.filter(p => 
    p.status === 'declined' || p.status === 'removed'
  );
  
  const creatorProfile = players.find(p => p.userId === teeTime.creatorId)?.profile;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Players</CardTitle>
        <div className="flex items-center">
          <span className="mr-2 text-sm font-medium">
            {teeTime.currentPlayers}/{teeTime.maxPlayers}
          </span>
          
          {isCreator && teeTime.status === 'open' && !readOnly && (
            <Button
              size="sm"
              onClick={() => setShowInviteDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Invite Players
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs
          tabs={[
            {
              id: 'confirmed',
              label: <>
                Confirmed
                <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  {confirmedPlayers.length}
                </Badge>
              </>,
              content: (
                <div className="space-y-2 mt-2">
                  {confirmedPlayers.map((player, index) => (
                    <div 
                      key={`confirmed_${player.userId}_${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center">
                        <Avatar 
                          src={player.profile?.photoURL} 
                          alt={player.profile?.displayName || 'Player'} 
                          size="sm" 
                        />
                        <div className="ml-3">
                          <div className="flex items-center">
                            <div className="text-sm font-medium">
                              {player.profile?.displayName || (userLoading[player.userId] ? (
                                <span className="flex items-center">
                                  <LoadingSpinner size="xs" className="mr-1" />
                                  Loading...
                                </span>
                              ) : 'Unknown Player')}
                            </div>
                            {player.userId === teeTime.creatorId && (
                              <Badge variant="outline" className="ml-2 text-xs">Host</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1 inline" />
                            Joined {player.joinedAt instanceof Date ? 
                              formatDistance(player.joinedAt, new Date(), { addSuffix: true }) : 
                              'recently'}
                          </div>
                        </div>
                      </div>
                      
                      {isCreator && player.userId !== teeTime.creatorId && !readOnly && (
                        <Tooltip content="Remove player from tee time">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePlayer(player.userId)}
                            isLoading={isOperationPending('remove', player.userId)}
                            disabled={isOperationPending('remove', player.userId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                  
                  {confirmedPlayers.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md">
                      No confirmed players yet
                    </div>
                  )}
                </div>
              )
            },
            {
              id: 'requests',
              label: <>
                Requests
                {joinRequestPlayers.length > 0 && (
                  <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {joinRequestPlayers.length}
                  </Badge>
                )}
              </>,
              content: isCreator ? (
                <div className="space-y-2 mt-2">
                  {joinRequestPlayers.map((player, index) => (
                    <div 
                      key={`request_${player.userId}_${player.joinedAt instanceof Date ? player.joinedAt.getTime() : ''}_${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
                    >
                      <div className="flex items-center">
                        <Avatar 
                          src={player.profile?.photoURL} 
                          alt={player.profile?.displayName || 'Player'} 
                          size="sm" 
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium">
                            {player.profile?.displayName || (userLoading[player.userId] ? (
                              <span className="flex items-center">
                                <LoadingSpinner size="xs" className="mr-1" />
                                Loading...
                              </span>
                            ) : 'Unknown Player')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1 inline" />
                            Requested {player.joinedAt instanceof Date ? 
                              formatDistance(player.joinedAt, new Date(), { addSuffix: true }) : 
                              'recently'}
                          </div>
                        </div>
                      </div>
                      
                      {!readOnly && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprovePlayer(player.userId)}
                            isLoading={isOperationPending('approve', player.userId)}
                            disabled={isOperationPending('approve', player.userId)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemovePlayer(player.userId)}
                            isLoading={isOperationPending('remove', player.userId)}
                            disabled={isOperationPending('remove', player.userId)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {joinRequestPlayers.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md">
                      No pending join requests
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                  Only the host can see join requests
                </div>
              )
            },
            {
              id: 'invitations',
              label: <>
                Invitations
                {invitedPlayers.length > 0 && (
                  <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {invitedPlayers.length}
                  </Badge>
                )}
              </>,
              content: (
                <div className="space-y-2 mt-2">
                  {invitedPlayers.map((player, index) => (
                    <div 
                      key={`invitation_${player.userId}_${player.joinedAt instanceof Date ? player.joinedAt.getTime() : ''}_${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="flex items-center">
                        <Avatar 
                          src={player.profile?.photoURL} 
                          alt={player.profile?.displayName || 'Player'} 
                          size="sm" 
                        />
                        <div className="ml-3">
                          <div className="flex items-center">
                            <div className="text-sm font-medium">
                              {player.profile?.displayName || (userLoading[player.userId] ? (
                                <span className="flex items-center">
                                  <LoadingSpinner size="xs" className="mr-1" />
                                  Loading...
                                </span>
                              ) : 'Unknown Player')}
                            </div>
                            <Badge className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Invited
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <Mail className="w-3 h-3 mr-1 inline" />
                            Invited {player.joinedAt instanceof Date ? 
                              formatDistance(player.joinedAt, new Date(), { addSuffix: true }) : 
                              'recently'}
                          </div>
                        </div>
                      </div>
                      
                      {isCreator && !readOnly && (
                        <div className="flex items-center">
                          <Badge className="mr-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Pending
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePlayer(player.userId)}
                            isLoading={isOperationPending('remove', player.userId)}
                            disabled={isOperationPending('remove', player.userId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {invitedPlayers.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md">
                      No pending invitations
                    </div>
                  )}
                </div>
              )
            },
            {
              id: 'declined',
              label: 'Past',
              content: isCreator ? (
                <div className="space-y-2 mt-2">
                  {declinedPlayers.map((player, index) => (
                    <div 
                      key={`declined_${player.userId}_${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800 opacity-60"
                    >
                      <div className="flex items-center">
                        <Avatar 
                          src={player.profile?.photoURL} 
                          alt={player.profile?.displayName || 'Player'} 
                          size="sm" 
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium">
                            {player.profile?.displayName || (userLoading[player.userId] ? (
                              <span className="flex items-center">
                                <LoadingSpinner size="xs" className="mr-1" />
                                Loading...
                              </span>
                            ) : 'Unknown Player')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {player.status === 'declined' ? 'Declined' : 'Removed'}
                          </div>
                        </div>
                      </div>
                      
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprovePlayer(player.userId)}
                          isLoading={isOperationPending('approve', player.userId)}
                          disabled={isOperationPending('approve', player.userId)}
                        >
                          Re-invite
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {declinedPlayers.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                      No declined or removed players
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800 rounded-md mt-2">
                  Only the host can see past invitations
                </div>
              )
            },
          ]}
          defaultTab="confirmed"
          onChange={setActiveTab}
          variant="pills"
        />
        
        {/* Player capacity info */}
        <div className="mt-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Player Capacity</div>
            <div className="text-sm font-medium">{teeTime.currentPlayers}/{teeTime.maxPlayers}</div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 mt-2 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                teeTime.currentPlayers >= teeTime.maxPlayers
                  ? 'bg-red-500'
                  : teeTime.currentPlayers >= teeTime.maxPlayers * 0.75
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (teeTime.currentPlayers / teeTime.maxPlayers) * 100)}%` }}
            ></div>
          </div>
        </div>
        
        {/* Host information */}
        {teeTime.creatorId && creatorProfile && (
          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Host Information</div>
            <div className="flex items-center">
              <Avatar
                src={creatorProfile.photoURL}
                alt={creatorProfile.displayName || 'Host'}
                size="md"
                className="border-2 border-white dark:border-gray-900"
              />
              <div className="ml-3">
                <div className="font-medium">{creatorProfile.displayName || 'Anonymous Host'}</div>
                {creatorProfile.handicapIndex !== null && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Handicap: {creatorProfile.handicapIndex}
                  </div>
                )}
                {creatorProfile.homeCourse && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Home Course: {creatorProfile.homeCourse}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Display loading state when host info is loading */}
        {teeTime.creatorId && !creatorProfile && userLoading[teeTime.creatorId] && (
          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Host Information</div>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div className="ml-3 flex items-center">
                <LoadingSpinner size="sm" className="mr-2" />
                <span className="text-gray-500">Loading host information...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Legend/Help section */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Info className="w-3.5 h-3.5 mr-1" />
            Player Status Legend
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Confirmed Players
            </div>
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              Join Requests
            </div>
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Invitations
            </div>
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              Past/Declined
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Invite dialog with enhanced UI and feedback */}
      <Dialog 
        open={showInviteDialog} 
        onClose={() => {
          if (!isInviting) {
            setShowInviteDialog(false);
            setSearchQuery('');
            setSelectedUser(null);
            setSearchResults([]);
            setInviteError('');
            setNoResultsMessage('');
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Invite Players</DialogTitle>
        </DialogHeader>
        
        <DialogContent>
          <form onSubmit={handleInviteSubmit}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Search for players by name to invite them to this tee time.
              </p>
              
              <div className="relative">
                <Input
                  label="Search Players"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a name to search..."
                  rightIcon={isSearching ? <LoadingSpinner size="sm" /> : <Search className="h-4 w-4" />}
                  disabled={isSearching || isInviting}
                />
                {searchQuery.length > 0 && !isSearching && (
                  <button
                    type="button"
                    className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setNoResultsMessage('');
                    }}
                    disabled={isInviting}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {noResultsMessage && (
                <div className="flex items-center p-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
                  {noResultsMessage}
                </div>
              )}
              
              {searchQuery.length > 0 && searchQuery.length < 2 && (
                <div className="flex items-center p-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <AlertCircle className="h-4 w-4 mr-2 text-gray-400" />
                  Please enter at least 2 characters to search
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                  {searchResults.map((user, index) => (
                    <div 
                      key={`search_${user.uid}_${index}`}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        selectedUser?.uid === user.uid ? 'bg-gray-100 dark:bg-gray-800' : ''
                      }`}
                      onClick={() => handleSelectUser(user)}
                    >
                      <Avatar 
                        src={user.photoURL} 
                        alt={user.displayName || 'User'} 
                        size="sm" 
                      />
                      <div className="ml-2">
                        <p className="font-medium">{user.displayName || 'Anonymous User'}</p>
                        {user.homeCourse && (
                          <p className="text-xs text-gray-500">Home: {user.homeCourse}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedUser && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Selected Player:</p>
                  <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <Avatar 
                      src={selectedUser.photoURL} 
                      alt={selectedUser.displayName || 'User'} 
                      size="sm" 
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium">{selectedUser.displayName || 'Anonymous User'}</p>
                      {selectedUser.homeCourse && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Home: {selectedUser.homeCourse}</p>
                      )}
                      {selectedUser.handicapIndex !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Handicap: {selectedUser.handicapIndex}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => setSelectedUser(null)}
                      disabled={isInviting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {inviteError && (
                <div className="flex items-start p-3 text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-md">
                  <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}
              
              <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    The player will receive a notification and will need to accept your invitation to join this tee time.
                  </div>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowInviteDialog(false)}
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInviteSubmit}
            isLoading={isInviting}
            disabled={!selectedUser || isInviting}
          >
            {isInviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
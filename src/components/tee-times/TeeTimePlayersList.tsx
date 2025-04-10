// src/components/tee-times/TeeTimePlayersList.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { TeeTime, TeeTimePlayer } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';

interface TeeTimePlayersListProps {
  teeTime: TeeTime;
  players: (TeeTimePlayer & { profile?: UserProfile })[];
  isCreator: boolean;
  onApprovePlayer?: (playerId: string) => Promise<void>;
  onRemovePlayer?: (playerId: string) => Promise<void>;
  onInvitePlayer?: (userId: string) => Promise<void>;
  onSearchUsers?: (query: string) => Promise<UserProfile[]>;
}

export function TeeTimePlayersList({
  teeTime,
  players,
  isCreator,
  onApprovePlayer,
  onRemovePlayer,
  onInvitePlayer,
  onSearchUsers
}: TeeTimePlayersListProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  
  // Search users when query changes
  const searchUsers = useCallback(async (query: string) => {
    if (!onSearchUsers || query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await onSearchUsers(query);
      
      // Filter out users who are already in the tee time
      const filteredResults = results.filter(user => 
        !players.some(player => player.userId === user.uid)
      );
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    }
  }, [onSearchUsers, players]);
  
  // Handle user selection
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setInviteError('');
  };
  
  // Handle invite submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      setInviteError('Please select a user to invite');
      return;
    }
    
    setIsInviting(true);
    setInviteError('');
    
    try {
      if (onInvitePlayer) {
        await onInvitePlayer(selectedUser.uid);
      }
      
      // Reset form
      setSearchQuery('');
      setSelectedUser(null);
      setSearchResults([]);
      setShowInviteDialog(false);
    } catch (error) {
      console.error('Error inviting player:', error);
      setInviteError('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };
  
  // Group players by status
  const confirmedPlayers = players.filter(p => p.status === 'confirmed');
  const pendingPlayers = players.filter(p => p.status === 'pending');
  const declinedPlayers = players.filter(p => p.status === 'declined');
  
  const creatorProfile = players.find(p => p.userId === teeTime.creatorId)?.profile;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Players</CardTitle>
        <div className="flex items-center">
          <span className="mr-2 text-sm font-medium">
            {teeTime.currentPlayers}/{teeTime.maxPlayers}
          </span>
          
          {isCreator && teeTime.status === 'open' && (
            <Button
              size="sm"
              onClick={() => setShowInviteDialog(true)}
            >
              Invite Players
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Confirmed players */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Confirmed Players ({confirmedPlayers.length})
            </h4>
            <div className="space-y-2">
              {confirmedPlayers.map(player => (
                <div 
                  key={player.userId}
                  className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-center">
                    <Avatar 
                      src={player.profile?.photoURL} 
                      alt={player.profile?.displayName || 'Player'} 
                      size="sm" 
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium">
                        {player.profile?.displayName || 'Anonymous Player'}
                        {player.userId === teeTime.creatorId && (
                          <Badge variant="outline" className="ml-2 text-xs">Host</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Joined {player.joinedAt instanceof Date ? 
                          format(player.joinedAt, 'MMM d, yyyy') : 
                          'recently'}
                      </div>
                    </div>
                  </div>
                  
                  {isCreator && player.userId !== teeTime.creatorId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePlayer && onRemovePlayer(player.userId)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              
              {confirmedPlayers.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No confirmed players yet
                </div>
              )}
            </div>
          </div>
          
          {/* Pending requests */}
          {(isCreator || pendingPlayers.length > 0) && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Pending Requests ({pendingPlayers.length})
              </h4>
              <div className="space-y-2">
                {pendingPlayers.map(player => (
                  <div 
                    key={player.userId}
                    className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex items-center">
                      <Avatar 
                        src={player.profile?.photoURL} 
                        alt={player.profile?.displayName || 'Player'} 
                        size="sm" 
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium">
                          {player.profile?.displayName || 'Anonymous Player'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {player.invitedBy ? 'Invited' : 'Requested'} {player.joinedAt instanceof Date ? 
                            format(player.joinedAt, 'MMM d, yyyy') : 
                            'recently'}
                        </div>
                      </div>
                    </div>
                    
                    {isCreator && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => onApprovePlayer && onApprovePlayer(player.userId)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRemovePlayer && onRemovePlayer(player.userId)}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                
                {pendingPlayers.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No pending requests
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      {/* Invite dialog */}
      <Dialog 
        open={showInviteDialog} 
        onClose={() => setShowInviteDialog(false)}
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
              
              <Input
                label="Search Players"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Type a name to search..."
              />
              
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                  {searchResults.map(user => (
                    <div 
                      key={user.uid}
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
                          <p className="text-xs text-gray-500">{user.homeCourse}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {searchQuery.length > 0 && searchResults.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No users found matching "{searchQuery}"
                </p>
              )}
              
              {selectedUser && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Selected Player:</p>
                  <div className="flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <Avatar 
                      src={selectedUser.photoURL} 
                      alt={selectedUser.displayName || 'User'} 
                      size="sm" 
                    />
                    <div className="ml-2">
                      <p className="font-medium">{selectedUser.displayName}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {inviteError && (
                <p className="text-sm text-red-500">{inviteError}</p>
              )}
            </div>
          </form>
        </DialogContent>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowInviteDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInviteSubmit}
            isLoading={isInviting}
            disabled={!selectedUser || isInviting}
          >
            Send Invitation
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
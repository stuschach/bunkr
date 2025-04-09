// src/components/tee-times/TeeTimePlayersList.tsx
'use client';

import React, { useState } from 'react';
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
  onInvitePlayer?: (email: string) => Promise<void>;
}

export function TeeTimePlayersList({
  teeTime,
  players,
  isCreator,
  onApprovePlayer,
  onRemovePlayer,
  onInvitePlayer
}: TeeTimePlayersListProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) {
      setInviteError('Please enter an email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }
    
    setIsInviting(true);
    setInviteError('');
    
    try {
      if (onInvitePlayer) {
        await onInvitePlayer(inviteEmail);
      }
      setInviteEmail('');
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
                          Requested {player.joinedAt instanceof Date ? 
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
                Enter the email address of the player you'd like to invite to this tee time.
              </p>
              
              <Input
                label="Email Address"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError('');
                }}
                error={inviteError}
                placeholder="player@example.com"
              />
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
          >
            Send Invitation
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
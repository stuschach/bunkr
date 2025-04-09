// src/app/(app)/tee-times/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTimePlayersList } from '@/components/tee-times/TeeTimePlayersList';
import { TeeTime, TeeTimePlayer } from '@/types/tee-times';
import { UserProfile } from '@/types/auth';

export default function TeeTimeDetails() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    error,
    getTeeTimeDetails,
    joinTeeTime,
    cancelTeeTime,
    approvePlayer,
    removePlayer,
    invitePlayer
  } = useTeeTime();
  
  // State
  const [teeTime, setTeeTime] = useState<TeeTime | null>(null);
  const [players, setPlayers] = useState<(TeeTimePlayer & { profile?: UserProfile })[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  
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
  
  // Load tee time details
  useEffect(() => {
    const loadTeeTimeDetails = async () => {
      const result = await getTeeTimeDetails(teeTimeId);
      setTeeTime(result.teeTime);
      setPlayers(result.players);
    };
    
    loadTeeTimeDetails();
  }, [teeTimeId, getTeeTimeDetails]);
  
  // Handle join request
  const handleJoinRequest = async () => {
    if (!user) {
      router.push(`/login?returnUrl=/tee-times/${teeTimeId}`);
      return;
    }
    
    setJoinRequestLoading(true);
    
    try {
      const success = await joinTeeTime(teeTimeId);
      
      if (success) {
        // Add the user to players list
        setPlayers(prev => [
          ...prev,
          {
            userId: user.uid,
            status: 'pending',
            joinedAt: new Date(),
            profile: {
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              email: user.email,
              createdAt: new Date()
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Error joining tee time:', error);
    } finally {
      setJoinRequestLoading(false);
    }
  };
  
  // Handle cancel tee time
  const handleCancelTeeTime = async () => {
    setIsCancelling(true);
    
    try {
      const success = await cancelTeeTime(teeTimeId);
      
      if (success) {
        // Update the tee time status in state
        if (teeTime) {
          setTeeTime({
            ...teeTime,
            status: 'cancelled'
          });
        }
        
        setShowCancelDialog(false);
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
    } finally {
      setIsCancelling(false);
    }
  };
  
  // Handle approve player
  const handleApprovePlayer = async (playerId: string) => {
    try {
      const success = await approvePlayer(teeTimeId, playerId);
      
      if (success && teeTime) {
        // Update players list
        setPlayers(prev => prev.map(player => {
          if (player.userId === playerId) {
            return {
              ...player,
              status: 'confirmed'
            };
          }
          return player;
        }));
        
        // Update tee time player count
        setTeeTime({
          ...teeTime,
          currentPlayers: teeTime.currentPlayers + 1,
          status: teeTime.currentPlayers + 1 >= teeTime.maxPlayers ? 'full' : 'open'
        });
      }
    } catch (error) {
      console.error('Error approving player:', error);
    }
  };
  
  // Handle remove player
  const handleRemovePlayer = async (playerId: string) => {
    try {
      const success = await removePlayer(teeTimeId, playerId);
      
      if (success && teeTime) {
        // Check if the player being removed was confirmed
        const playerToRemove = players.find(player => player.userId === playerId);
        const wasConfirmed = playerToRemove?.status === 'confirmed';
        
        // Remove player from the list
        setPlayers(prev => prev.filter(player => player.userId !== playerId));
        
        // Update tee time player count if the player was confirmed
        if (wasConfirmed) {
          setTeeTime({
            ...teeTime,
            currentPlayers: Math.max(teeTime.currentPlayers - 1, 1),
            status: 'open' // If removing a player, tee time should become open
          });
        }
      }
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };
  
  // Handle invite player
  const handleInvitePlayer = async (email: string) => {
    try {
      const success = await invitePlayer(teeTimeId, email);
      return success;
    } catch (error) {
      console.error('Error inviting player:', error);
      return false;
    }
  };
  
  // Format date and time for display
  const formattedDate = teeTime?.dateTime
    ? format(new Date(teeTime.dateTime), 'EEEE, MMMM d, yyyy')
    : '';
    
  const formattedTime = teeTime?.dateTime
    ? format(new Date(teeTime.dateTime), 'h:mm a')
    : '';
  
  // Get creator profile from players list
  const creatorProfile = teeTime 
    ? players.find(player => player.userId === teeTime.creatorId)?.profile
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
            {error || 'Tee time not found'}
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
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Group Size</div>
                    <div className="font-medium">{teeTime.currentPlayers} / {teeTime.maxPlayers} players</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Created By</div>
                    <div className="font-medium">
                      {creatorProfile?.displayName || 'Unknown Host'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-gray-200 dark:border-gray-800">
              {!isCreator && !isPlayer && !hasPendingRequest && teeTime.status === 'open' && (
                <Button
                  className="w-full"
                  onClick={handleJoinRequest}
                  isLoading={joinRequestLoading}
                  disabled={joinRequestLoading}
                >
                  Request to Join
                </Button>
              )}
              
              {hasPendingRequest && (
                <div className="w-full text-center">
                  <Badge variant="outline" className="py-2 px-4">
                    Request Pending Approval
                  </Badge>
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
                <div className="w-full text-center">
                  <Badge variant="outline" className="py-2 px-4">
                    You're Hosting This Tee Time
                  </Badge>
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
            onApprovePlayer={handleApprovePlayer}
            onRemovePlayer={handleRemovePlayer}
            onInvitePlayer={handleInvitePlayer}
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
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to cancel this tee time? This action cannot be undone
            and all players will be notified.
          </p>
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
    </div>
  );
}
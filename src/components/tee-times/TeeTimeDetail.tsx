// src/components/tee-times/TeeTimeDetail.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, formatDistance } from 'date-fns';
import Image from 'next/image';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTimePlayersList } from '@/components/tee-times/TeeTimePlayersList';
import { UserSearchModal } from '@/components/tee-times/UserSearchModal';
import { TeeTime, TeeTimePlayer, UserProfile } from '@/types/tee-times';
import { 
  Clock, 
  Calendar, 
  Trophy, 
  MapPin, 
  Users, 
  Plus, 
  Edit, 
  AlertCircle,
  Check,
  X,
  Trash2,
  Globe,
  Lock,
  Eye,
  Share2,
  InfoIcon,
  Mail
} from 'lucide-react';
import { ConfirmationDialog } from '@/components/common/dialogs/ConfirmationDialog';
import { EditTeeTimeForm } from '@/components/tee-times/EditTeeTimeForm';
import { TeeTimeInvitation } from '@/components/tee-times/TeeTimeInvitation';
import { Separator } from '@/components/ui/Separator';
import { Tooltip } from '@/components/ui/Tooltip';

interface TeeTimeDetailProps {
  teeTimeId: string;
}

export function TeeTimeDetail({ teeTimeId }: TeeTimeDetailProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    isLoading, 
    error, 
    getTeeTimeDetails, 
    getUserProfile,
    cancelTeeTime, 
    deleteTeeTime, // Import the new deleteTeeTime function
    approvePlayer, 
    removePlayer,
    invitePlayer,
    respondToInvitation,
    pendingOperations,
    subscribeTeeTime,
    subscribeTeeTimePlayers
  } = useTeeTime();
  
  // States
  const [teeTime, setTeeTime] = useState<TeeTime | null>(null);
  const [players, setPlayers] = useState<(TeeTimePlayer & { profile?: UserProfile })[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state for delete confirmation
  const [showRemovePlayerConfirm, setShowRemovePlayerConfirm] = useState<string | null>(null);
  const [isUserInvited, setIsUserInvited] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<'pending' | 'accepted' | 'declined' | null>(null);
  
  // Function to get tee time details
  const fetchTeeTimeDetails = useCallback(async () => {
    if (!teeTimeId) {
      router.push('/tee-times');
      return;
    }
    
    try {
      const { teeTime: teeTimeData, players: playersData } = await getTeeTimeDetails(teeTimeId);
      
      if (!teeTimeData) {
        // Tee time not found
        router.push('/tee-times?error=tee-time-not-found');
        return;
      }
      
      setTeeTime(teeTimeData);
      setPlayers(playersData);
      
      // Get creator profile
      if (teeTimeData.creatorId) {
        const creatorProfile = await getUserProfile(teeTimeData.creatorId);
        setCreatorProfile(creatorProfile);
      }
      
      // Check if current user is invited
      if (user) {
        const currentUserPlayer = playersData.find(p => p.userId === user.uid);
        
        setIsUserInvited(
          !!currentUserPlayer && 
          currentUserPlayer.requestType === 'invitation'
        );
        
        if (currentUserPlayer?.requestType === 'invitation') {
          if (currentUserPlayer.status === 'pending') {
            setInvitationStatus('pending');
          } else if (currentUserPlayer.status === 'confirmed') {
            setInvitationStatus('accepted');
          } else if (currentUserPlayer.status === 'declined') {
            setInvitationStatus('declined');
          }
        } else {
          setInvitationStatus(null);
        }
      }
    } catch (error) {
      console.error('Error fetching tee time details:', error);
    }
  }, [teeTimeId, user, getTeeTimeDetails, getUserProfile, router]);
  
  // Set up real-time listeners for tee time and players
  useEffect(() => {
    if (!teeTimeId) return;
    
    // Subscribe to tee time updates
    const unsubscribeTeeTime = subscribeTeeTime(teeTimeId, (updatedTeeTime) => {
      if (updatedTeeTime) {
        setTeeTime(updatedTeeTime);
      } else {
        // Tee time was deleted or not found
        router.push('/tee-times?error=tee-time-not-found');
      }
    });
    
    // Subscribe to player updates
    const unsubscribePlayers = subscribeTeeTimePlayers(teeTimeId, async (updatedPlayers) => {
      // Get profiles for players
      const playersWithProfiles = await Promise.all(
        updatedPlayers.map(async (player) => {
          // Check if we already have this player's profile
          const existingPlayer = players.find(p => p.userId === player.userId);
          if (existingPlayer?.profile) {
            return { ...player, profile: existingPlayer.profile };
          }
          
          // Otherwise get the profile
          const profile = await getUserProfile(player.userId);
          return { ...player, profile };
        })
      );
      
      setPlayers(playersWithProfiles);
      
      // Update invitation status for current user
      if (user) {
        const currentUserPlayer = playersWithProfiles.find(p => p.userId === user.uid);
        
        setIsUserInvited(
          !!currentUserPlayer && 
          currentUserPlayer.requestType === 'invitation'
        );
        
        if (currentUserPlayer?.requestType === 'invitation') {
          if (currentUserPlayer.status === 'pending') {
            setInvitationStatus('pending');
          } else if (currentUserPlayer.status === 'confirmed') {
            setInvitationStatus('accepted');
          } else if (currentUserPlayer.status === 'declined') {
            setInvitationStatus('declined');
          }
        } else {
          setInvitationStatus(null);
        }
      }
    });
    
    // Load initial data
    fetchTeeTimeDetails();
    
    return () => {
      unsubscribeTeeTime();
      unsubscribePlayers();
    };
  }, [teeTimeId, user, fetchTeeTimeDetails, subscribeTeeTime, subscribeTeeTimePlayers, getUserProfile, players, router]);
  
  // Handle approving a player
  const handleApprovePlayer = async (playerId: string) => {
    if (!teeTimeId || !user) return;
    
    try {
      await approvePlayer(teeTimeId, playerId);
    } catch (error) {
      console.error('Error approving player:', error);
    }
  };
  
  // Handle removing a player
  const handleRemovePlayer = async (playerId: string) => {
    if (!teeTimeId || !user) return;
    
    try {
      await removePlayer(teeTimeId, playerId);
      setShowRemovePlayerConfirm(null);
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };
  
  // Handle inviting a player
  const handleInvitePlayer = async (userId: string) => {
    if (!teeTimeId || !user) return;
    
    try {
      const success = await invitePlayer(teeTimeId, userId);
      
      if (success) {
        setShowInviteModal(false);
      }
    } catch (error) {
      console.error('Error inviting player:', error);
    }
  };
  
  // Handle responding to an invitation
  const handleRespondToInvitation = async (response: 'accept' | 'decline') => {
    if (!teeTimeId || !user) return;
    
    try {
      // Use the correct context function
      const success = await respondToInvitation(teeTimeId, user.uid, response);
      
      if (success) {
        // Update local state optimistically
        setInvitationStatus(response === 'accept' ? 'accepted' : 'declined');
      }
    } catch (error) {
      console.error(`Error ${response === 'accept' ? 'accepting' : 'declining'} invitation:`, error);
    }
  };
  
  // Handle cancelling tee time
  const handleCancelTeeTime = async () => {
    if (!teeTimeId || !user) return;
    
    try {
      const success = await cancelTeeTime(teeTimeId);
      
      if (success) {
        setShowCancelConfirm(false);
        router.push('/tee-times/my');
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
    }
  };

  // Handle deleting tee time
  const handleDeleteTeeTime = async () => {
    if (!teeTimeId || !user) return;
    
    try {
      const success = await deleteTeeTime(teeTimeId);
      
      if (success) {
        setShowDeleteConfirm(false);
        router.push('/tee-times/my');
      }
    } catch (error) {
      console.error('Error deleting tee time:', error);
    }
  };
  
  // Handle sharing tee time
  const handleShareTeeTime = () => {
    if (!teeTime) return;
    
    const shareUrl = `${window.location.origin}/tee-times/${teeTimeId}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Golf Tee Time at ${teeTime.courseName}`,
        text: `Join me for golf at ${teeTime.courseName} on ${format(new Date(teeTime.dateTime || Date.now()), 'EEEE, MMMM d')}`,
        url: shareUrl
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };
  
  // Loading state
  if (isLoading && !teeTime) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" />
      </div>
    );
  }
  
  // Error state
  if (error && !teeTime) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-300 dark:border-red-700">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              Error Loading Tee Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-red-500 dark:text-red-400">
              {error instanceof Error ? error.message : String(error)}
            </Text>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => router.push('/tee-times')}
            >
              Back to Tee Times
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Not found state
  if (!teeTime) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-500" />
              Tee Time Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Text>The tee time you're looking for does not exist or has been removed.</Text>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => router.push('/tee-times')}
            >
              Back to Tee Times
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Check if tee time is in the past
  const teeTimeDate = new Date(teeTime.dateTime || Date.now());
  const isPastTeeTime = isPast(teeTimeDate);
  
  // Determine if user is creator
  const isCreator = user && teeTime.creatorId === user.uid;
  
  // Determine visibility icon
  const visibilityIcon = teeTime.visibility === 'public' ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />;
  
  // Filter pending players for creator
  const pendingPlayers = players.filter(player => 
    player.status === 'pending' && 
    player.requestType === 'join_request'
  );
  
  // Get confirmed players
  const confirmedPlayers = players.filter(player => 
    player.status === 'confirmed'
  );

  const isDeleting = pendingOperations[`delete_${teeTimeId}`];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Tee Time</CardTitle>
            </CardHeader>
            <CardContent>
              <EditTeeTimeForm 
                teeTime={teeTime}
                onSave={() => setShowEditForm(false)}
                onCancel={() => setShowEditForm(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Invite Players Modal */}
      {showInviteModal && (
        <UserSearchModal
          onClose={() => setShowInviteModal(false)}
          onSelectUser={handleInvitePlayer}
          excludeUserIds={players.map(player => player.userId)}
        />
      )}
      
      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <ConfirmationDialog
          title="Cancel Tee Time"
          message="Are you sure you want to cancel this tee time? This action cannot be undone."
          confirmLabel="Cancel Tee Time"
          cancelLabel="Keep Tee Time"
          confirmVariant="destructive"
          isOpen={showCancelConfirm}
          onConfirm={handleCancelTeeTime}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmationDialog
          title="Delete Tee Time"
          message="Are you sure you want to permanently delete this tee time? This action cannot be undone and all confirmed players will be notified."
          confirmLabel="Delete Tee Time"
          cancelLabel="Keep Tee Time"
          confirmVariant="destructive"
          isOpen={showDeleteConfirm}
          onConfirm={handleDeleteTeeTime}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      
      {/* Remove Player Confirmation */}
      {showRemovePlayerConfirm && (
        <ConfirmationDialog
          title="Remove Player"
          message="Are you sure you want to remove this player from the tee time?"
          confirmLabel="Remove Player"
          cancelLabel="Cancel"
          confirmVariant="destructive"
          isOpen={!!showRemovePlayerConfirm}
          onConfirm={() => handleRemovePlayer(showRemovePlayerConfirm)}
          onCancel={() => setShowRemovePlayerConfirm(null)}
        />
      )}
      
      {/* Tee Time Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-6">
        <div className="relative h-32 bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700">
          <div className="absolute inset-0 bg-[url('/images/golf-pattern.png')] opacity-10"></div>
          
          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <Badge 
              className={`${
                teeTime.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                teeTime.status === 'full' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200' :
                teeTime.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              } font-medium text-xs px-2.5 py-1 rounded-full flex items-center`}
            >
              {teeTime.status === 'open' ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
                  Open
                </>
              ) : teeTime.status === 'full' ? (
                <>
                  <div className="w-2 h-2 bg-amber-500 rounded-full mr-1.5"></div>
                  Full
                </>
              ) : teeTime.status === 'cancelled' ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div>
                  Cancelled
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-1.5"></div>
                  {teeTime.status}
                </>
              )}
            </Badge>
          </div>
          
          {/* Course Name */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-bold text-white truncate">{teeTime.courseName}</h1>
          </div>
        </div>
        
        <div className="p-4">
          {/* Display invitation banner for invited users */}
          {isUserInvited && invitationStatus === 'pending' && (
            <TeeTimeInvitation
              teeTime={teeTime}
              creatorProfile={creatorProfile}
              onAccept={() => handleRespondToInvitation('accept')}
              onDecline={() => handleRespondToInvitation('decline')}
              isLoading={pendingOperations[`respond_${teeTimeId}_accept`] || pendingOperations[`respond_${teeTimeId}_decline`]}
            />
          )}
          
          {/* Invitation Response Status */}
          {isUserInvited && invitationStatus === 'accepted' && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg flex items-center">
              <Check className="h-5 w-5 mr-2 text-green-500" />
              <span>You have accepted this invitation and will be joining this tee time.</span>
            </div>
          )}
          
          {isUserInvited && invitationStatus === 'declined' && (
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg flex items-center">
              <X className="h-5 w-5 mr-2 text-gray-500" />
              <span>You have declined this invitation.</span>
            </div>
          )}
          
          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Date & Time */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-start">
                <div className="flex items-center justify-center bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg p-2.5 mr-3">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Date</Text>
                  <Text className="font-medium">
                    {teeTime.dateTime && format(new Date(teeTime.dateTime), 'EEEE, MMMM d, yyyy')}
                  </Text>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center justify-center bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg p-2.5 mr-3">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Time</Text>
                  <Text className="font-medium">
                    {teeTime.dateTime && format(new Date(teeTime.dateTime), 'h:mm a')}
                  </Text>
                </div>
              </div>
            </div>
            
            {/* Players & Visibility */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-start">
                <div className="flex items-center justify-center bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg p-2.5 mr-3">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Players</Text>
                  <Text className="font-medium">
                    {teeTime.currentPlayers} / {teeTime.maxPlayers} players
                  </Text>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex items-center justify-center bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg p-2.5 mr-3">
                  {visibilityIcon}
                </div>
                <div>
                  <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Visibility</Text>
                  <Text className="font-medium capitalize">
                    {teeTime.visibility}
                  </Text>
                </div>
              </div>
            </div>
            
            {/* Host */}
            <div className="flex items-start">
              <div className="flex items-center justify-center bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg p-2.5 mr-3">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">Host</Text>
                <div className="flex items-center mt-1">
                  {creatorProfile && (
                    <>
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={creatorProfile.photoURL || undefined} />
                        <AvatarFallback>
                          {creatorProfile.displayName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <Text className="font-medium">{creatorProfile.displayName}</Text>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Description */}
          {teeTime.description && (
            <div className="mb-6">
              <Heading level={3} className="text-lg font-medium mb-2">Description</Heading>
              <Text className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {teeTime.description}
              </Text>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {/* Creator actions */}
            {isCreator && !isPastTeeTime && teeTime.status !== 'cancelled' && (
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setShowEditForm(true)}
                  variant="outline"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                
                <Button 
                  onClick={() => setShowInviteModal(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Players
                </Button>
                
                <Button 
                  onClick={() => setShowCancelConfirm(true)}
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Tee Time
                </Button>

                <Button 
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete Tee Time'}
                </Button>
              </div>
            )}
            
            {/* Share button for everyone */}
            <Button 
              onClick={handleShareTeeTime}
              variant="outline"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          
          {/* Pending Requests Notification for Creator */}
          {isCreator && pendingPlayers.length > 0 && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
                <Heading level={3} className="text-amber-800 dark:text-amber-300 font-medium">
                  Pending Join Requests
                </Heading>
              </div>
              <Text className="text-amber-700 dark:text-amber-200 mb-3">
                You have {pendingPlayers.length} pending {pendingPlayers.length === 1 ? 'request' : 'requests'} to join this tee time.
              </Text>
              <div className="flex flex-wrap gap-2">
                {pendingPlayers.slice(0, 3).map(player => (
                  <div key={player.userId} className="flex items-center bg-white dark:bg-gray-800 rounded-full px-3 py-1.5 shadow-sm">
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarImage src={player.profile?.photoURL || undefined} />
                      <AvatarFallback>
                        {player.profile?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">
                      {player.profile?.displayName || 'Unknown Player'}
                    </span>
                  </div>
                ))}
                {pendingPlayers.length > 3 && (
                  <div className="flex items-center bg-white dark:bg-gray-800 rounded-full px-3 py-1.5 shadow-sm">
                    <span className="font-medium text-sm">
                      +{pendingPlayers.length - 3} more
                    </span>
                  </div>
                )}
              </div>
              <Separator className="my-3" />
              <Text className="text-sm text-amber-700 dark:text-amber-200 mb-3">
                Please review these requests and confirm or decline them using the players panel below.
              </Text>
            </div>
          )}
          
          {/* Cancelled Warning */}
          {teeTime.status === 'cancelled' && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <Text className="text-red-700 dark:text-red-200 font-medium">
                  This tee time has been cancelled
                </Text>
              </div>
            </div>
          )}
          
          {/* Past Tee Time Warning */}
          {isPastTeeTime && teeTime.status !== 'cancelled' && (
            <div className="mb-6 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <Text className="text-gray-700 dark:text-gray-300 font-medium">
                  This tee time has already occurred
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Players Section */}
      <TeeTimePlayersList
        teeTime={teeTime}
        players={players}
        isCreator={isCreator}
        onApprovePlayer={handleApprovePlayer}
        onRemovePlayer={(playerId) => setShowRemovePlayerConfirm(playerId)}
        onInvitePlayer={handleInvitePlayer}
        readOnly={isPastTeeTime || teeTime.status === 'cancelled'}
        pendingRequestsCount={pendingPlayers.length}
        pendingInvitationsCount={players.filter(p => 
          p.status === 'pending' && p.requestType === 'invitation'
        ).length}
      />
    </div>
  );
}
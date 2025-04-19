// src/components/tee-times/TeeTimeDetail.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, isPast, formatDistance } from 'date-fns';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useUsers } from '@/lib/hooks/useUsers';
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
  AlertTriangle,
  Check,
  X,
  Users,
  Clock,
  Calendar,
  Mail,
  Edit,
  Plus,
  Trash2,
  Globe,
  Lock,
  Eye,
  Share2,
  AlertCircle,
  Trophy,
  MapPin
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationDialog } from '@/components/common/dialogs/ConfirmationDialog';
import { EditTeeTimeForm } from '@/components/tee-times/EditTeeTimeForm';
import { TeeTimeInvitation } from '@/components/tee-times/TeeTimeInvitation';
import { Separator } from '@/components/ui/Separator';
import { Tooltip } from '@/components/ui/Tooltip';
import { UserSearchModal } from '@/components/tee-times/UserSearchModal';

interface TeeTimeDetailProps {
  teeTimeId: string;
}

export function TeeTimeDetail({ teeTimeId }: TeeTimeDetailProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Use both hooks - useTeeTime for tee time operations and useUsers for user profile operations
  const { 
    isLoading, 
    error, 
    getTeeTimeDetails, 
    cancelTeeTime, 
    deleteTeeTime,
    approvePlayer, 
    removePlayer,
    invitePlayer,
    respondToInvitation,
    pendingOperations,
    subscribeTeeTime,
    subscribeTeeTimePlayers
  } = useTeeTime();

  // Explicitly use the useUsers hook for user-related operations
  const { 
    getUserById, 
    getUsersByIds, 
    loading: userLoading 
  } = useUsers();
  
  // States
  const [teeTime, setTeeTime] = useState<TeeTime | null>(null);
  const [players, setPlayers] = useState<(TeeTimePlayer & { profile?: UserProfile })[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemovePlayerConfirm, setShowRemovePlayerConfirm] = useState<string | null>(null);
  const [isUserInvited, setIsUserInvited] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<'pending' | 'accepted' | 'declined' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Track local deletion state
  
  // Refs to prevent infinite loops
  const loadingAttemptedRef = useRef<Record<string, boolean>>({});
  const isMountedRef = useRef(true); // Track if component is mounted
  const initialLoadCompletedRef = useRef(false);
  const unsubscribersRef = useRef<(() => void)[]>([]); // Store unsubscribe functions

  // Set up cleanup for mounted ref and listeners
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up all listeners when component unmounts
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      });
      unsubscribersRef.current = [];
    };
  }, []);
  
  // Function to get tee time details
  const fetchTeeTimeDetails = useCallback(async () => {
    if (!teeTimeId || !isMountedRef.current) {
      return;
    }
    
    try {
      const { teeTime: teeTimeData, players: playersData } = await getTeeTimeDetails(teeTimeId);
      
      if (!teeTimeData) {
        // Tee time not found
        router.push('/tee-times?error=tee-time-not-found');
        return;
      }
      
      if (isMountedRef.current) {
        setTeeTime(teeTimeData);
      }
      
      // Get all player IDs including the creator
      const userIds = [
        ...playersData.map(p => p.userId),
        teeTimeData.creatorId
      ].filter(Boolean);
      
      // Check if getUsersByIds is available, fall back to individual fetches if not
      if (getUsersByIds && userIds.length > 0) {
        const uniqueUserIds = [...new Set(userIds)];
        try {
          const profiles = await getUsersByIds(uniqueUserIds);
          
          if (!isMountedRef.current) return;
          
          // Add profiles to player data
          const playersWithProfiles = playersData.map(player => ({
            ...player,
            profile: profiles[player.userId] || undefined
          }));
          
          setPlayers(playersWithProfiles);
          
          // Set creator profile
          if (teeTimeData.creatorId && profiles[teeTimeData.creatorId]) {
            setCreatorProfile(profiles[teeTimeData.creatorId]);
          }
        } catch (error) {
          console.error('Error fetching profiles in batch:', error);
          // Fall back to setting players without profiles
          if (isMountedRef.current) {
            setPlayers(playersData);
          }
        }
      } else {
        // Fall back to individual profile fetches or setting players without profiles
        if (isMountedRef.current) {
          setPlayers(playersData);
          
          // Try to load creator profile individually
          if (teeTimeData.creatorId && getUserById && !loadingAttemptedRef.current[teeTimeData.creatorId]) {
            loadingAttemptedRef.current[teeTimeData.creatorId] = true;
            try {
              const profile = await getUserById(teeTimeData.creatorId);
              if (profile && isMountedRef.current) {
                setCreatorProfile(profile);
              }
            } catch (err) {
              console.error('Error fetching creator profile:', err);
            }
          }
        }
      }
      
      // Check if current user is invited
      if (user && isMountedRef.current) {
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
      
      initialLoadCompletedRef.current = true;
    } catch (error) {
      console.error('Error fetching tee time details:', error);
    }
  }, [teeTimeId, user, getTeeTimeDetails, getUsersByIds, getUserById, router]);
  
  // Enhanced processing of player updates - fixed to avoid circular dependency
  const processPlayerUpdates = useCallback(async (updatedPlayers: TeeTimePlayer[]) => {
    if (!isMountedRef.current) return;
    
    try {
      // Filter to only players that need profiles
      const playersNeedingProfiles = updatedPlayers.filter(player => {
        // Find if we already have this player's profile
        const existingPlayer = players.find(p => p.userId === player.userId);
        return !existingPlayer?.profile;
      });
      
      const playerIdsNeedingProfiles = playersNeedingProfiles.map(p => p.userId);
      
      // Only fetch new profiles if needed and if getUsersByIds is available
      if (playerIdsNeedingProfiles.length > 0 && getUsersByIds) {
        // Get unique IDs to fetch
        const uniquePlayerIds = [...new Set(playerIdsNeedingProfiles)];
        
        try {
          // Fetch profiles in batch
          const newProfiles = await getUsersByIds(uniquePlayerIds);
          
          if (!isMountedRef.current) return;
          
          // Create a map of existing profiles
          const existingProfiles: Record<string, UserProfile | undefined> = {};
          players.forEach(player => {
            if (player.profile) {
              existingProfiles[player.userId] = player.profile;
            }
          });
          
          // Combine profiles - use existing ones first, fallback to new ones
          const combinedProfiles = {
            ...existingProfiles,
            ...newProfiles
          };
          
          // Combine updated players with their profiles
          const playersWithProfiles = updatedPlayers.map(player => ({
            ...player,
            profile: combinedProfiles[player.userId]
          }));
          
          setPlayers(playersWithProfiles);
        } catch (error) {
          console.error('Error fetching batch user profiles:', error);
          // Fall back to just updating player data without profiles
          setPlayers(prevPlayers => {
            const result = updatedPlayers.map(player => {
              // Try to find existing player data to preserve profile
              const existingPlayer = prevPlayers.find(p => p.userId === player.userId);
              return {
                ...player,
                profile: existingPlayer?.profile
              };
            });
            return result;
          });
        }
      } else {
        // No new profiles needed or getUsersByIds not available, just update players
        setPlayers(prevPlayers => {
          const result = updatedPlayers.map(player => {
            // Try to find existing player data to preserve profile
            const existingPlayer = prevPlayers.find(p => p.userId === player.userId);
            return {
              ...player,
              profile: existingPlayer?.profile
            };
          });
          return result;
        });
      }
      
      // Update invitation status for current user
      if (user) {
        const currentUserPlayer = updatedPlayers.find(p => p.userId === user.uid);
        
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
      console.error('Error processing player updates:', error);
    }
  }, [getUsersByIds, user, players]);
  
  // Set up real-time listeners for tee time and players
  useEffect(() => {
    if (!teeTimeId) return;
    
    // Clear any previous unsubscribers
    unsubscribersRef.current.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (err) {
        console.error('Error unsubscribing:', err);
      }
    });
    unsubscribersRef.current = [];
    
    // Subscribe to tee time updates
    const unsubscribeTeeTime = subscribeTeeTime(teeTimeId, async (updatedTeeTime) => {
      if (!isMountedRef.current) return;
      
      if (updatedTeeTime) {
        setTeeTime(updatedTeeTime);
        
        // Only fetch creator profile if not already loaded
        if (updatedTeeTime.creatorId && !creatorProfile && !loadingAttemptedRef.current[updatedTeeTime.creatorId]) {
          // Mark as attempted
          loadingAttemptedRef.current[updatedTeeTime.creatorId] = true;
          
          if (getUserById) {
            try {
              const profile = await getUserById(updatedTeeTime.creatorId);
              if (profile && isMountedRef.current) {
                setCreatorProfile(profile);
              }
            } catch (error) {
              console.error('Error fetching creator profile:', error);
            }
          }
        }
      } else {
        // Tee time was deleted or not found
        if (!isDeleting) { // Only redirect if we're not in the middle of our own deletion
          router.push('/tee-times?error=tee-time-not-found');
        }
      }
    });
    
    // Store the unsubscribe function
    unsubscribersRef.current.push(unsubscribeTeeTime);
    
    // Subscribe to player updates
    const unsubscribePlayers = subscribeTeeTimePlayers(teeTimeId, (updatedPlayers) => {
      if (isMountedRef.current) {
        processPlayerUpdates(updatedPlayers);
      }
    });
    
    // Store the unsubscribe function
    unsubscribersRef.current.push(unsubscribePlayers);
    
    // Load initial data if needed
    if (!initialLoadCompletedRef.current) {
      fetchTeeTimeDetails();
    }
    
    // Clean up on unmount or when teeTimeId changes
    return () => {
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      });
      unsubscribersRef.current = [];
    };
  }, [
    teeTimeId, 
    fetchTeeTimeDetails, 
    subscribeTeeTime, 
    subscribeTeeTimePlayers, 
    getUserById, 
    processPlayerUpdates, 
    router,
    isDeleting
  ]);
  
  // Handle approving a player
  const handleApprovePlayer = async (playerId: string) => {
    if (!teeTimeId || !user) return;
    
    try {
      await approvePlayer(teeTimeId, playerId);
    } catch (error) {
      console.error('Error approving player:', error);
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve player',
        variant: 'error'
      });
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
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove player',
        variant: 'error'
      });
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
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite player',
        variant: 'error'
      });
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
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${response} invitation`,
        variant: 'error'
      });
    }
  };
  
  // Handle cancelling tee time
  const handleCancelTeeTime = async () => {
    if (!teeTimeId || !user) return;
    
    try {
      const success = await cancelTeeTime(teeTimeId);
      
      if (success) {
        setShowCancelConfirm(false);
        
        // Show success toast
        showToast({
          title: 'Tee time cancelled',
          description: 'Your tee time has been cancelled',
          variant: 'success'
        });
        
        // Navigate to my tee times page
        router.push('/tee-times/my');
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel tee time',
        variant: 'error'
      });
    }
  };

  // Enhanced delete handler to properly clean up listeners
  const handleDeleteTeeTime = async () => {
    if (!teeTimeId || !user) return;
    
    try {
      // First set local deleting state
      setIsDeleting(true);
      setShowDeleteConfirm(false);
      
      // Clear listeners before delete to prevent Firebase errors
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      });
      unsubscribersRef.current = [];
      
      // Set isMounted to false to prevent any state updates during deletion
      isMountedRef.current = false;
      
      // Perform deletion with a slight delay to ensure listeners are cleaned up
      setTimeout(async () => {
        try {
          const success = await deleteTeeTime(teeTimeId);
          
          if (success) {
            // Show success toast
            showToast({
              title: 'Tee time deleted',
              description: 'Your tee time has been successfully deleted',
              variant: 'success'
            });
            
            // Navigate away
            router.push('/tee-times/my');
          } else {
            // If deletion failed, restore mounted state
            isMountedRef.current = true;
            setIsDeleting(false);
            
            // Show error
            showToast({
              title: 'Error',
              description: 'Failed to delete tee time',
              variant: 'error'
            });
          }
        } catch (error) {
          console.error('Error in delete timeout:', error);
          
          // If deletion failed, restore mounted state
          isMountedRef.current = true;
          setIsDeleting(false);
          
          // Show error
          showToast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to delete tee time',
            variant: 'error'
          });
        }
      }, 300); // Small delay to ensure listeners are removed
    } catch (error) {
      console.error('Error deleting tee time:', error);
      
      // If deletion failed, restore state
      isMountedRef.current = true;
      setIsDeleting(false);
      
      // Show error toast
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete tee time',
        variant: 'error'
      });
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
        showToast({
          title: 'Link copied',
          description: 'Tee time link copied to clipboard',
          variant: 'success'
        });
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };
  
  // Loading state
  if ((isLoading && !teeTime) || isDeleting) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" />
        {isDeleting && <Text className="ml-3">Deleting tee time...</Text>}
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

  // Check if delete operation is pending in context
  const deletionPending = pendingOperations[`delete_${teeTimeId}`];

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
                  {userLoading[teeTime.creatorId] ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <Text>Loading host...</Text>
                    </div>
                  ) : creatorProfile ? (
                    <>
                      <Avatar 
                        src={creatorProfile.photoURL}
                        alt={creatorProfile.displayName || 'Unknown Host'}
                        size="sm"
                        className="mr-2"
                      />
                      <Text className="font-medium">{creatorProfile.displayName || 'Unknown Host'}</Text>
                    </>
                  ) : (
                    <Text className="font-medium">Unknown Host</Text>
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
                  disabled={deletionPending || isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deletionPending || isDeleting ? 'Deleting...' : 'Delete Tee Time'}
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
                    <Avatar 
                      src={player.profile?.photoURL}
                      alt={player.profile?.displayName || 'Unknown Player'}
                      size="sm"
                      className="mr-2"
                    />
                    <span className="font-medium text-sm">
                      {player.profile?.displayName || (userLoading[player.userId] ? 'Loading...' : 'Unknown Player')}
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

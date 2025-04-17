// src/lib/contexts/TeeTimeContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  TeeTime, 
  TeeTimeFormData, 
  TeeTimePlayer, 
  TeeTimeFilters,
  TeeTimeStatus
} from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import {
  getTeeTimeById,
  getTeeTimesList,
  getUserTeeTimes,
  getTeeTimeWithPlayers,
  createTeeTime as createTeeTimeService,
  updateTeeTime,
  cancelTeeTime,
  deleteTeeTime, // Import the new deleteTeeTime function
  requestToJoinTeeTime,
  approvePlayerRequest,
  removePlayerFromTeeTime,
  invitePlayerToTeeTime,
  searchUsersByName,
  subscribeTeeTime,
  subscribeTeeTimePlayers,
  respondToInvitation as respondToInvitationService,
  TeeTimeError,
  TeeTimeNotFoundError,
  TeeTimeAccessError,
  TeeTimeStatusError,
} from '@/lib/services/tee-times-service';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { useToast } from '@/lib/hooks/useToast';
import { useUsers } from '@/lib/hooks/useUsers'; // Import the useUsers hook
import { DocumentSnapshot } from 'firebase/firestore';

// Define the context interface
interface TeeTimeContextValue {
  // State
  isLoading: boolean;
  error: Error | null;
  
  // Tee Time operations
  createTeeTime: (data: TeeTimeFormData) => Promise<string | null>;
  updateTeeTime: (teeTimeId: string, data: Partial<TeeTimeFormData>) => Promise<boolean>;
  cancelTeeTime: (teeTimeId: string) => Promise<boolean>;
  deleteTeeTime: (teeTimeId: string) => Promise<boolean>; // New function for tee time deletion
  getTeeTimeDetails: (teeTimeId: string) => Promise<{ teeTime: TeeTime | null; players: (TeeTimePlayer & { profile?: UserProfile })[] }>;
  subscribeTeeTime: (teeTimeId: string, callback: (teeTime: TeeTime | null) => void) => () => void;
  subscribeTeeTimePlayers: (teeTimeId: string, callback: (players: TeeTimePlayer[]) => void) => () => void;
  
  // Player operations
  joinTeeTime: (teeTimeId: string) => Promise<boolean>;
  approvePlayer: (teeTimeId: string, playerId: string) => Promise<boolean>;
  removePlayer: (teeTimeId: string, playerId: string) => Promise<boolean>;
  invitePlayer: (teeTimeId: string, userId: string) => Promise<boolean>;
  respondToInvitation: (teeTimeId: string, playerId: string, response: 'accept' | 'decline') => Promise<boolean>;
  
  // Listing operations
  getPublicTeeTimesList: (filters?: TeeTimeFilters, lastVisible?: DocumentSnapshot, pageSize?: number) => Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }>;
  getUserTeeTimes: (status?: string, lastVisible?: DocumentSnapshot, pageSize?: number) => Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }>;
  
  // User operations
  getUserProfile: (userId: string) => Promise<UserProfile | null>;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  
  // Metadata
  pendingOperations: Record<string, boolean>;
  resetError: () => void;
}

// Create the context with default values
const TeeTimeContext = createContext<TeeTimeContextValue | undefined>(undefined);

// Provider props
interface TeeTimeProviderProps {
  children: ReactNode;
}

// Provider component
export function TeeTimeProvider({ children }: TeeTimeProviderProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const notificationCreator = useNotificationCreator();
  const { getUserById, getUsersByIds, searchUsers: searchUsersHook } = useUsers(); // Use the hook
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pendingOperations, setPendingOperations] = useState<Record<string, boolean>>({});
  
  // Reset error helper
  const resetError = useCallback(() => setError(null), []);
  
  // Track operation state by ID
  const trackOperation = useCallback((id: string, isActive: boolean) => {
    setPendingOperations(prev => ({
      ...prev,
      [id]: isActive
    }));
  }, []);
  
  // Get a user by ID (now uses the useUsers hook)
  const getUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!userId) return null;
    
    try {
      // Use the hook's getUserById method
      return await getUserById(userId);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [getUserById]);
  
  // Get player profiles for a tee time (now uses the useUsers hook)
  const getPlayerProfiles = useCallback(async (
    players: TeeTimePlayer[]
  ): Promise<(TeeTimePlayer & { profile?: UserProfile })[]> => {
    if (!players.length) return players;
    
    try {
      // Get all user IDs
      const userIds = players.map(player => player.userId);
      
      // Use batch loading
      const profiles = await getUsersByIds(userIds);
      
      // Combine players with their profiles
      return players.map(player => ({
        ...player,
        profile: profiles[player.userId]
      }));
    } catch (error) {
      console.error('Error fetching player profiles:', error);
      return players;
    }
  }, [getUsersByIds]);
  
  // Create a new tee time
  const handleCreateTeeTime = useCallback(async (teeTimeData: TeeTimeFormData): Promise<string | null> => {
    if (!user) {
      setError(new Error('You must be logged in to create a tee time'));
      return null;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `create_tee_time`;
    trackOperation(operationId, true);
    
    try {
      const teeTimeId = await createTeeTimeService(user.uid, teeTimeData);
      
      if (!teeTimeId) {
        throw new Error('Failed to create tee time');
      }
      
      showToast({
        title: 'Tee time created',
        description: 'Your tee time has been successfully created',
        variant: 'success'
      });
      
      return teeTimeId;
    } catch (error) {
      console.error('Error creating tee time:', error);
      setError(error instanceof Error ? error : new Error('Failed to create tee time'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tee time',
        variant: 'error'
      });
      
      return null;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, showToast]);
  
  // Get tee time details with players and profiles
  const getTeeTimeDetails = useCallback(async (
    teeTimeId: string
  ): Promise<{ teeTime: TeeTime | null; players: (TeeTimePlayer & { profile?: UserProfile })[] }> => {
    setIsLoading(true);
    resetError();
    
    try {
      const { teeTime, players } = await getTeeTimeWithPlayers(teeTimeId);
      
      if (!teeTime) {
        setError(new TeeTimeNotFoundError(teeTimeId));
        return { teeTime: null, players: [] };
      }
      
      const playersWithProfiles = await getPlayerProfiles(players);
      
      return { teeTime, players: playersWithProfiles };
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to load tee time details'));
      console.error('Error getting tee time details:', error);
      return { teeTime: null, players: [] };
    } finally {
      setIsLoading(false);
    }
  }, [resetError, getPlayerProfiles]);
  
  // UPDATED: Get tee times for the current user with proper pagination
  const getUserTeeTimesList = useCallback(async (
    status?: string,
    lastVisible?: DocumentSnapshot,
    pageSize: number = 20
  ): Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }> => {
    if (!user) {
      setError(new Error('You must be logged in to view your tee times'));
      return { teeTimes: [], lastVisible: null };
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      // Get paginated tee times
      const result = await getUserTeeTimes(
        user.uid,
        status as TeeTimeStatus,
        lastVisible,
        pageSize
      );
      
      return result;
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to load your tee times'));
      console.error('Error getting user tee times:', error);
      return { teeTimes: [], lastVisible: null };
    } finally {
      setIsLoading(false);
    }
  }, [user, resetError]);
  
  // Get public tee times list with pagination
  const getPublicTeeTimesList = useCallback(async (
    filters?: TeeTimeFilters,
    lastVisible?: DocumentSnapshot,
    pageSize: number = 10
  ): Promise<{ teeTimes: TeeTime[]; lastVisible: DocumentSnapshot | null }> => {
    setIsLoading(true);
    resetError();
    
    try {
      const result = await getTeeTimesList(filters, lastVisible, pageSize);
      return result;
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to load tee times'));
      console.error('Error getting tee times list:', error);
      return { teeTimes: [], lastVisible: null };
    } finally {
      setIsLoading(false);
    }
  }, [resetError]);
  
  // Update an existing tee time
  const handleUpdateTeeTime = useCallback(async (
    teeTimeId: string,
    updates: Partial<TeeTimeFormData>
  ): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to update a tee time'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `update_${teeTimeId}`;
    trackOperation(operationId, true);
    
    try {
      await updateTeeTime(teeTimeId, user.uid, updates);
      
      showToast({
        title: 'Tee time updated',
        description: 'Your tee time has been successfully updated',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error updating tee time:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to update tee time'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update tee time',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, showToast]);
  
  // Cancel a tee time
  const handleCancelTeeTime = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to cancel a tee time'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `cancel_${teeTimeId}`;
    trackOperation(operationId, true);
    
    try {
      await cancelTeeTime(teeTimeId, user.uid);
      
      showToast({
        title: 'Tee time cancelled',
        description: 'Your tee time has been cancelled',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error cancelling tee time:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to cancel tee time'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel tee time',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, showToast]);

  // NEW: Delete a tee time completely
  const handleDeleteTeeTime = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to delete a tee time'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `delete_${teeTimeId}`;
    trackOperation(operationId, true);
    
    try {
      // First get the tee time details for notifications
      const { teeTime, players } = await getTeeTimeDetails(teeTimeId);
      
      if (!teeTime) {
        throw new TeeTimeNotFoundError(teeTimeId);
      }
      
      // Delete the tee time and get confirmed players
      const confirmedPlayers = await deleteTeeTime(teeTimeId, user.uid);
      
      // Send notifications to all confirmed players
      const confirmedPlayerIds = players
        .filter(player => player.status === 'confirmed' && player.userId !== user.uid)
        .map(player => player.userId);
      
      if (confirmedPlayerIds.length > 0) {
        await Promise.all(confirmedPlayerIds.map(playerId => 
          notificationCreator.sendNotification(
            playerId,
            'tee-time-deleted',
            teeTimeId,
            'tee-time',
            {
              courseName: teeTime.courseName,
              creatorName: user.displayName || 'A user',
              date: teeTime.dateTime instanceof Date 
                ? teeTime.dateTime.toISOString() 
                : new Date(teeTime.dateTime || Date.now()).toISOString()
            }
          )
        ));
      }
      
      showToast({
        title: 'Tee time deleted',
        description: 'Your tee time has been successfully deleted',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting tee time:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to delete tee time'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete tee time',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, getTeeTimeDetails, notificationCreator, showToast]);
  
  // Request to join a tee time
  const handleJoinRequest = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to join a tee time'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `join_${teeTimeId}`;
    trackOperation(operationId, true);
    
    try {
      await requestToJoinTeeTime(teeTimeId, user.uid);
      
      showToast({
        title: 'Request sent',
        description: 'Your request to join this tee time has been sent',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error joining tee time:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to request to join tee time'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join tee time',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, showToast]);
  
  // Approve a player's request
  const handleApprovePlayer = useCallback(async (
    teeTimeId: string,
    playerId: string
  ): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to approve requests'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `approve_${teeTimeId}_${playerId}`;
    trackOperation(operationId, true);
    
    try {
      await approvePlayerRequest(teeTimeId, playerId, user.uid);
      
      // Get tee time details for notification
      const teeTime = await getTeeTimeById(teeTimeId);
      
      if (teeTime) {
        // Send notification (in practice, this is handled by Firebase Function)
        notificationCreator.notifyTeeTimeApproved(
          playerId,
          teeTimeId,
          teeTime.courseName,
          teeTime.dateTime || new Date()
        );
      }
      
      showToast({
        title: 'Player approved',
        description: 'The player has been added to your tee time',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error approving player:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to approve player request'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve player',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, notificationCreator, showToast]);
  
  // Remove a player from a tee time
  const handleRemovePlayer = useCallback(async (
    teeTimeId: string,
    playerId: string
  ): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to remove players'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `remove_${teeTimeId}_${playerId}`;
    trackOperation(operationId, true);
    
    try {
      await removePlayerFromTeeTime(teeTimeId, playerId, user.uid);
      
      showToast({
        title: 'Player removed',
        description: 'The player has been removed from your tee time',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error removing player:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to remove player'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove player',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, showToast]);
  
  // Invite a player to a tee time with improved reliability
  const handleInvitePlayer = useCallback(async (
    teeTimeId: string,
    invitedUserId: string
  ): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to invite players'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `invite_${teeTimeId}_${invitedUserId}`;
    trackOperation(operationId, true);
    
    try {
      // First try to get the tee time details to validate
      const teeTime = await getTeeTimeById(teeTimeId);
      
      if (!teeTime) {
        throw new Error(`Tee time ${teeTimeId} not found`);
      }
      
      // Verify user is creator
      if (teeTime.creatorId !== user.uid) {
        throw new Error('Only the creator can invite players');
      }
      
      // Verify tee time is not full
      if (teeTime.status === 'full') {
        throw new Error('This tee time is already full');
      }
      
      // Add player to the tee time with invitedBy field
      await invitePlayerToTeeTime(teeTimeId, invitedUserId, user.uid);
      
      // Send notification directly from client for reliability
      await notificationCreator.notifyTeeTimeInvite(
        invitedUserId,
        teeTimeId,
        teeTime.courseName,
        teeTime.dateTime || new Date()
      );
      
      showToast({
        title: 'Invitation sent',
        description: 'Your invitation has been sent',
        variant: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error inviting player:', error);
      
      setError(error instanceof Error ? error : new Error('Failed to invite player'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite player',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, notificationCreator, showToast]);
  
  // Handle responding to an invitation - FIXED to properly centralize notification logic
  const handleRespondToInvitation = useCallback(async (
    teeTimeId: string,
    playerId: string,
    response: 'accept' | 'decline'
  ): Promise<boolean> => {
    if (!user) {
      setError(new Error('You must be logged in to respond to invitations'));
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    const operationId = `respond_${teeTimeId}_${response}`;
    trackOperation(operationId, true);
    
    try {
      // Call the service function first
      await respondToInvitationService(teeTimeId, playerId, response);
      
      // Get tee time details for notification
      const teeTime = await getTeeTimeById(teeTimeId);
      
      if (teeTime?.creatorId) {
        // Send notification to creator
        await notificationCreator.sendNotification(
          teeTime.creatorId,
          response === 'accept' ? 'tee-time-invitation-accepted' : 'tee-time-invitation-declined',
          teeTimeId,
          'tee-time',
          {
            courseName: teeTime.courseName,
            date: teeTime.dateTime instanceof Date 
              ? teeTime.dateTime.toISOString() 
              : new Date(teeTime.dateTime || Date.now()).toISOString()
          }
        );
      }
      
      // Show toast message
      showToast({
        title: response === 'accept' ? 'Invitation Accepted' : 'Invitation Declined',
        description: response === 'accept'
          ? 'You have successfully joined the tee time'
          : 'You have declined the invitation',
        variant: response === 'accept' ? 'success' : 'info'
      });
      
      return true;
    } catch (error) {
      console.error(`Error responding to invitation:`, error);
      
      setError(error instanceof Error ? error : new Error('Failed to respond to invitation'));
      
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to respond to invitation',
        variant: 'error'
      });
      
      return false;
    } finally {
      setIsLoading(false);
      trackOperation(operationId, false);
    }
  }, [user, resetError, trackOperation, notificationCreator, showToast]);
  
  // Search users by name - Use the hook's searchUsers method
  const handleSearchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
    try {
      return await searchUsersHook(query, { maxResults: 20 });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }, [searchUsersHook]);
  
  // Provide subscription methods
  const handleSubscribeTeeTime = useCallback((
    teeTimeId: string,
    callback: (teeTime: TeeTime | null) => void
  ): (() => void) => {
    return subscribeTeeTime(teeTimeId, callback);
  }, []);
  
  const handleSubscribeTeeTimePlayers = useCallback((
    teeTimeId: string,
    callback: (players: TeeTimePlayer[]) => void
  ): (() => void) => {
    return subscribeTeeTimePlayers(teeTimeId, callback);
  }, []);
  
  // Create the context value object
  const contextValue = useMemo(() => ({
    // State
    isLoading,
    error,
    pendingOperations,
    resetError,
    
    // Tee Time operations
    createTeeTime: handleCreateTeeTime,
    updateTeeTime: handleUpdateTeeTime,
    cancelTeeTime: handleCancelTeeTime,
    deleteTeeTime: handleDeleteTeeTime, // Add the new delete function
    getTeeTimeDetails,
    subscribeTeeTime: handleSubscribeTeeTime,
    subscribeTeeTimePlayers: handleSubscribeTeeTimePlayers,
    
    // Player operations
    joinTeeTime: handleJoinRequest,
    approvePlayer: handleApprovePlayer,
    removePlayer: handleRemovePlayer,
    invitePlayer: handleInvitePlayer,
    respondToInvitation: handleRespondToInvitation,
    
    // Listing operations
    getPublicTeeTimesList,
    getUserTeeTimes: getUserTeeTimesList,
    
    // User operations
    getUserProfile,
    searchUsers: handleSearchUsers
  }), [
    isLoading,
    error,
    pendingOperations,
    resetError,
    handleCreateTeeTime,
    handleUpdateTeeTime,
    handleCancelTeeTime,
    handleDeleteTeeTime, // Add the new function to dependencies
    getTeeTimeDetails,
    handleSubscribeTeeTime,
    handleSubscribeTeeTimePlayers,
    handleJoinRequest,
    handleApprovePlayer,
    handleRemovePlayer,
    handleInvitePlayer,
    handleRespondToInvitation,
    getPublicTeeTimesList,
    getUserTeeTimesList,
    getUserProfile,
    handleSearchUsers
  ]);
  
  return (
    <TeeTimeContext.Provider value={contextValue}>
      {children}
    </TeeTimeContext.Provider>
  );
}

// Custom hook to use the tee time context
export function useTeeTime() {
  const context = useContext(TeeTimeContext);
  if (!context) {
    throw new Error('useTeeTime must be used within a TeeTimeProvider');
  }
  return context;
}

// Optionally export a higher-order component to wrap components with the provider
export function withTeeTime<P extends object>(Component: React.ComponentType<P>): React.FC<P> {
  return function WithTeeTimeComponent(props: P) {
    return (
      <TeeTimeProvider>
        <Component {...props} />
      </TeeTimeProvider>
    );
  };
}
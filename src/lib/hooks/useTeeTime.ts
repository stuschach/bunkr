// src/lib/hooks/useTeeTime.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  TeeTime, 
  TeeTimePlayer, 
  TeeTimeFormData,
  TeeTimeFilters
} from '@/types/tee-times';
import { UserProfile } from '@/types/auth';
import { 
  createTeeTime,
  getTeeTimeById,
  getTeeTimeWithPlayers,
  getTeeTimesList,
  getUserTeeTimes,
  updateTeeTime,
  cancelTeeTime,
  requestToJoinTeeTime,
  approvePlayerRequest,
  removePlayerFromTeeTime,
  invitePlayerToTeeTime,
  searchUsersByName
} from '@/lib/services/tee-times-service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export function useTeeTime() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error on new operations
  const resetError = () => setError(null);

  // Get user profile by ID
  const getUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const userData = userDoc.data();
      
      return {
        uid: userDoc.id,
        email: userData.email || null,
        displayName: userData.displayName || null,
        photoURL: userData.photoURL || null,
        createdAt: userData.createdAt?.toDate() || new Date(),
        handicapIndex: userData.handicapIndex || null,
        homeCourse: userData.homeCourse || null,
        profileComplete: userData.profileComplete || false,
        bio: userData.bio || null
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }, []);

  // Fetch player profiles for a tee time
  const getPlayerProfiles = useCallback(async (
    players: TeeTimePlayer[]
  ): Promise<(TeeTimePlayer & { profile?: UserProfile })[]> => {
    try {
      const playersWithProfiles = await Promise.all(
        players.map(async (player) => {
          const profile = await getUserProfile(player.userId);
          return { ...player, profile };
        })
      );
      
      return playersWithProfiles;
    } catch (error) {
      console.error('Error fetching player profiles:', error);
      return players;
    }
  }, [getUserProfile]);

  // Create a new tee time
  const handleCreateTeeTime = useCallback(async (teeTimeData: TeeTimeFormData): Promise<string | null> => {
    if (!user) {
      setError('You must be logged in to create a tee time');
      return null;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      console.log("Creating tee time with data:", teeTimeData);
      
      // Use the service function which already creates a post
      // The service already handles creating the post in the posts collection
      const teeTimeId = await createTeeTime(user.uid, teeTimeData);
      console.log("Tee time created with ID:", teeTimeId);
      
      return teeTimeId;
    } catch (error) {
      console.error('Error creating tee time:', error);
      setError('Failed to create tee time');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get a tee time with players and profiles
  const getTeeTimeDetails = useCallback(async (
    teeTimeId: string
  ): Promise<{ teeTime: TeeTime | null; players: (TeeTimePlayer & { profile?: UserProfile })[] }> => {
    setIsLoading(true);
    resetError();
    
    try {
      const { teeTime, players } = await getTeeTimeWithPlayers(teeTimeId);
      
      if (!teeTime) {
        setError('Tee time not found');
        return { teeTime: null, players: [] };
      }
      
      const playersWithProfiles = await getPlayerProfiles(players);
      
      return { teeTime, players: playersWithProfiles };
    } catch (error) {
      setError('Failed to load tee time details');
      console.error('Error getting tee time details:', error);
      return { teeTime: null, players: [] };
    } finally {
      setIsLoading(false);
    }
  }, [getPlayerProfiles]);

  // Get tee times for the current user
  const getUserTeeTimesList = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view your tee times');
      return [];
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      const teeTimes = await getUserTeeTimes(user.uid);
      return teeTimes;
    } catch (error) {
      setError('Failed to load your tee times');
      console.error('Error getting user tee times:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get public tee times list
  const getPublicTeeTimesList = useCallback(async (
    filters?: TeeTimeFilters,
    lastVisible?: any,
    pageSize: number = 10
  ) => {
    setIsLoading(true);
    resetError();
    
    try {
      const result = await getTeeTimesList(filters, lastVisible, pageSize);
      return result;
    } catch (error) {
      setError('Failed to load tee times');
      console.error('Error getting tee times list:', error);
      return { teeTimes: [], lastVisible: null };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update an existing tee time
  const handleUpdateTeeTime = useCallback(async (
    teeTimeId: string,
    updates: Partial<TeeTimeFormData>
  ): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to update a tee time');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      // The service will update the post automatically
      await updateTeeTime(teeTimeId, user.uid, updates);
      return true;
    } catch (error) {
      setError('Failed to update tee time');
      console.error('Error updating tee time:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Cancel a tee time
  const handleCancelTeeTime = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to cancel a tee time');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      // The service will update the post automatically
      await cancelTeeTime(teeTimeId, user.uid);
      return true;
    } catch (error) {
      setError('Failed to cancel tee time');
      console.error('Error cancelling tee time:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Request to join a tee time
  const handleJoinRequest = useCallback(async (teeTimeId: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to join a tee time');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      await requestToJoinTeeTime(teeTimeId, user.uid);
      return true;
    } catch (error) {
      setError('Failed to request to join tee time');
      console.error('Error joining tee time:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Approve a player's request
  const handleApprovePlayer = useCallback(async (
    teeTimeId: string,
    playerId: string
  ): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to approve requests');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      await approvePlayerRequest(teeTimeId, playerId, user.uid);
      return true;
    } catch (error) {
      setError('Failed to approve player request');
      console.error('Error approving player:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Remove a player from a tee time
  const handleRemovePlayer = useCallback(async (
    teeTimeId: string,
    playerId: string
  ): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to remove players');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      await removePlayerFromTeeTime(teeTimeId, playerId, user.uid);
      return true;
    } catch (error) {
      setError('Failed to remove player');
      console.error('Error removing player:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Invite a player to a tee time by userId instead of email
  const handleInvitePlayer = useCallback(async (
    teeTimeId: string,
    invitedUserId: string
  ): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to invite players');
      return false;
    }
    
    setIsLoading(true);
    resetError();
    
    try {
      await invitePlayerToTeeTime(teeTimeId, invitedUserId, user.uid);
      return true;
    } catch (error) {
      setError('Failed to invite player');
      console.error('Error inviting player:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Search users by name
  const handleSearchUsers = useCallback(async (
    query: string
  ): Promise<UserProfile[]> => {
    if (query.trim().length < 3) {
      return [];
    }
    
    try {
      return await searchUsersByName(query);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }, []);

  return {
    isLoading,
    error,
    resetError,
    getUserProfile,
    getPlayerProfiles,
    createTeeTime: handleCreateTeeTime,
    getTeeTimeDetails,
    getUserTeeTimes: getUserTeeTimesList,
    getPublicTeeTimesList,
    updateTeeTime: handleUpdateTeeTime,
    cancelTeeTime: handleCancelTeeTime,
    joinTeeTime: handleJoinRequest,
    approvePlayer: handleApprovePlayer,
    removePlayer: handleRemovePlayer,
    invitePlayer: handleInvitePlayer,
    searchUsers: handleSearchUsers,
  };
}
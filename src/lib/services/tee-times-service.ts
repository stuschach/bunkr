// src/lib/services/tee-times-service.ts
import { 
    addDoc, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    Timestamp, 
    serverTimestamp,
    runTransaction,
    DocumentReference,
    startAfter,
    setDoc,
    startAt,
    endAt
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase/config';
  import { 
    TeeTime, 
    TeeTimeFormData, 
    TeeTimePlayer, 
    TeeTimeStatus, 
    PlayerStatus,
    TeeTimeFilters
  } from '@/types/tee-times';
  import { UserProfile } from '@/types/auth';
  
  // Updated collection names to match Firestore rules
  const TEE_TIMES_COLLECTION = 'teeTimes';
  const TEE_TIME_PLAYERS_COLLECTION = 'teeTimes';
  const USER_TEE_TIMES_COLLECTION = 'users';
  
  // Helper function to convert Firestore data to TeeTime
  const convertToTeeTime = (doc: any): TeeTime => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      creatorId: data.creatorId || '',
      courseName: data.courseName || '',
      courseId: data.courseId || null,
      dateTime: data.dateTime?.toDate() || null,
      maxPlayers: data.maxPlayers || 4,
      currentPlayers: data.currentPlayers || 1,
      status: data.status || 'open',
      visibility: data.visibility || 'public',
      description: data.description || '',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  };
  
  /**
   * Create a new tee time
   * NOTE: This function no longer creates the post directly.
   * Post creation is handled by the usePostCreation hook
   */
  export const createTeeTime = async (
    userId: string, 
    teeTimeData: TeeTimeFormData
  ): Promise<string> => {
    try {
      // Combine date and time
      const dateTime = new Date(teeTimeData.date);
      const [hours, minutes] = teeTimeData.time.split(':').map(Number);
      dateTime.setHours(hours, minutes);
      
      // Create the tee time document
      const teeTimeRef = await addDoc(collection(db, TEE_TIMES_COLLECTION), {
        creatorId: userId,
        courseName: teeTimeData.courseName,
        courseId: teeTimeData.courseId || null,
        dateTime: Timestamp.fromDate(dateTime),
        maxPlayers: teeTimeData.maxPlayers,
        currentPlayers: 1, // Creator is the first player
        status: 'open' as TeeTimeStatus,
        visibility: teeTimeData.visibility,
        description: teeTimeData.description || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Add the creator as a confirmed player, using userId as document ID
      await setDoc(doc(db, TEE_TIMES_COLLECTION, teeTimeRef.id, 'players', userId), {
        userId: userId,
        status: 'confirmed' as PlayerStatus,
        joinedAt: serverTimestamp(),
        isCreator: true
      });
      
      // Add reference to user's tee times (as a subcollection)
      await addDoc(collection(db, USER_TEE_TIMES_COLLECTION, userId, 'teeTimes'), {
        teeTimeId: teeTimeRef.id,
        role: 'creator',
        status: 'confirmed' as PlayerStatus,
      });
      
      // Note: Post creation is now handled by the usePostCreation hook
      // in the component/hook layer, not here
      
      return teeTimeRef.id;
    } catch (error) {
      console.error('Error creating tee time:', error);
      throw error;
    }
  };
  
  // Get a single tee time by ID
  export const getTeeTimeById = async (teeTimeId: string): Promise<TeeTime | null> => {
    try {
      const teeTimeDoc = await getDoc(doc(db, TEE_TIMES_COLLECTION, teeTimeId));
      
      if (!teeTimeDoc.exists()) {
        return null;
      }
      
      return convertToTeeTime(teeTimeDoc);
    } catch (error) {
      console.error('Error getting tee time:', error);
      throw error;
    }
  };
  
  // Get tee time with players
  export const getTeeTimeWithPlayers = async (teeTimeId: string): Promise<{
    teeTime: TeeTime | null;
    players: TeeTimePlayer[];
  }> => {
    try {
      // Get tee time
      const teeTime = await getTeeTimeById(teeTimeId);
      
      if (!teeTime) {
        return { teeTime: null, players: [] };
      }
      
      // Get players from subcollection
      const playersSnapshot = await getDocs(collection(db, TEE_TIMES_COLLECTION, teeTimeId, 'players'));
      const players: TeeTimePlayer[] = playersSnapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          userId: data.userId || '',
          status: data.status || 'pending',
          joinedAt: data.joinedAt?.toDate() || new Date(),
          invitedBy: data.invitedBy || undefined,
        };
      });
      
      return { teeTime, players };
    } catch (error) {
      console.error('Error getting tee time with players:', error);
      throw error;
    }
  };
  
  // Get all public tee times with optional filters
  export const getTeeTimesList = async (
    filters?: TeeTimeFilters, 
    lastVisible?: any, 
    pageSize: number = 10
  ): Promise<{ teeTimes: TeeTime[]; lastVisible: any }> => {
    try {
      let teeTimesQuery: any = collection(db, TEE_TIMES_COLLECTION);
      
      // Base query constraints
      const constraints: any[] = [
        where('visibility', '==', 'public'),
        orderBy('dateTime', 'asc'),
      ];
      
      // Add status filter
      if (filters?.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      } else {
        // Exclude cancelled tee times by default
        constraints.push(where('status', '!=', 'cancelled'));
      }
      
      // Add date filter
      if (filters?.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        
        constraints.push(
          where('dateTime', '>=', Timestamp.fromDate(startOfDay)),
          where('dateTime', '<=', Timestamp.fromDate(endOfDay))
        );
      } else {
        // Only show future tee times by default
        constraints.push(where('dateTime', '>=', Timestamp.fromDate(new Date())));
      }
      
      // Add course filter
      if (filters?.courseId) {
        constraints.push(where('courseId', '==', filters.courseId));
      }
      
      // Apply pagination
      if (lastVisible) {
        constraints.push(startAfter(lastVisible));
      }
      
      // Apply limit
      constraints.push(limit(pageSize));
      
      // Build the query
      teeTimesQuery = query(teeTimesQuery, ...constraints);
      
      // Execute query
      const teeTimesSnapshot = await getDocs(teeTimesQuery);
      
      // Get the last visible document for pagination
      const lastVisibleDoc = teeTimesSnapshot.docs[teeTimesSnapshot.docs.length - 1];
      
      // Convert documents to TeeTime objects
      const teeTimes = teeTimesSnapshot.docs.map(convertToTeeTime);
      
      return { teeTimes, lastVisible: lastVisibleDoc };
    } catch (error) {
      console.error('Error getting tee times list:', error);
      throw error;
    }
  };
  
  // Get tee times for a specific user
  export const getUserTeeTimes = async (
    userId: string, 
    status?: TeeTimeStatus
  ): Promise<TeeTime[]> => {
    try {
      // Get user tee time IDs from user's subcollection
      const userTeeTimesSnapshot = await getDocs(collection(db, USER_TEE_TIMES_COLLECTION, userId, 'teeTimes'));
      const teeTimeIds = userTeeTimesSnapshot.docs.map(doc => (doc.data() || {}).teeTimeId).filter(Boolean);
      
      if (teeTimeIds.length === 0) {
        return [];
      }
      
      // Then get actual tee times
      let teeTimesQuery: any = query(
        collection(db, TEE_TIMES_COLLECTION),
        where('__name__', 'in', teeTimeIds)
      );
      
      // Add status filter if provided
      if (status) {
        teeTimesQuery = query(teeTimesQuery, where('status', '==', status));
      }
      
      // Add ordering by date
      teeTimesQuery = query(teeTimesQuery, orderBy('dateTime', 'asc'));
      
      const teeTimesSnapshot = await getDocs(teeTimesQuery);
      
      return teeTimesSnapshot.docs.map(convertToTeeTime);
    } catch (error) {
      console.error('Error getting user tee times:', error);
      throw error;
    }
  };
  
  // Update an existing tee time
  export const updateTeeTime = async (
    teeTimeId: string, 
    userId: string, 
    updates: Partial<TeeTimeFormData>
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new Error('Tee time not found');
      }
      
      // Verify user is the creator
      const teeTimeData = teeTimeDoc.data() || {};
      if (teeTimeData.creatorId !== userId) {
        throw new Error('Only the creator can update this tee time');
      }
      
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };
      
      // Update fields if they exist in the updates object
      if (updates.courseName) updateData.courseName = updates.courseName;
      if (updates.courseId !== undefined) updateData.courseId = updates.courseId;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.visibility) updateData.visibility = updates.visibility;
      
      // Handle date and time updates
      if (updates.date && updates.time) {
        const dateTime = new Date(updates.date);
        const [hours, minutes] = updates.time.split(':').map(Number);
        dateTime.setHours(hours, minutes);
        updateData.dateTime = Timestamp.fromDate(dateTime);
      }
      
      // Handle max players update with validation
      if (updates.maxPlayers && updates.maxPlayers !== teeTimeData.maxPlayers) {
        if (updates.maxPlayers < (teeTimeData.currentPlayers || 1)) {
          throw new Error('Cannot reduce max players below current player count');
        }
        updateData.maxPlayers = updates.maxPlayers;
        
        // Update status if necessary
        if (teeTimeData.status === 'full' && updates.maxPlayers > (teeTimeData.currentPlayers || 1)) {
          updateData.status = 'open';
        }
      }
      
      await updateDoc(teeTimeRef, updateData);
      
      // Find and update the corresponding post
      const postsQuery = query(
        collection(db, 'posts'),
        where('postType', '==', 'tee-time'),
        where('teeTimeId', '==', teeTimeId)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      if (!postsSnapshot.empty) {
        const postDoc = postsSnapshot.docs[0];
        const postData = postDoc.data() || {};
        
        // Update the post with new tee time details
        await updateDoc(doc(db, 'posts', postDoc.id), {
          courseName: updates.courseName || teeTimeData.courseName,
          maxPlayers: updates.maxPlayers || teeTimeData.maxPlayers,
          visibility: updates.visibility || teeTimeData.visibility,
          updatedAt: serverTimestamp(),
          // Update content to reflect changes
          content: `I'm hosting a tee time at ${updates.courseName || teeTimeData.courseName} on ${
            updateData.dateTime 
              ? updateData.dateTime.toDate().toLocaleDateString() 
              : teeTimeData.dateTime?.toDate()?.toLocaleDateString() || 'TBD'
          } at ${
            updateData.dateTime 
              ? updateData.dateTime.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
              : teeTimeData.dateTime?.toDate()?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'TBD'
          }. Looking for ${((updates.maxPlayers || teeTimeData.maxPlayers || 4) - (teeTimeData.currentPlayers || 1))} more players!`
        });
      }
    } catch (error) {
      console.error('Error updating tee time:', error);
      throw error;
    }
  };
  
  // Cancel a tee time
  export const cancelTeeTime = async (
    teeTimeId: string, 
    userId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new Error('Tee time not found');
      }
      
      // Verify user is the creator
      const teeTimeData = teeTimeDoc.data() || {};
      if (teeTimeData.creatorId !== userId) {
        throw new Error('Only the creator can cancel this tee time');
      }
      
      await updateDoc(teeTimeRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      
      // Find and update the corresponding post
      const postsQuery = query(
        collection(db, 'posts'),
        where('postType', '==', 'tee-time'),
        where('teeTimeId', '==', teeTimeId)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      if (!postsSnapshot.empty) {
        const postDoc = postsSnapshot.docs[0];
        
        // Update the post with cancelled status
        await updateDoc(doc(db, 'posts', postDoc.id), {
          content: `This tee time at ${teeTimeData.courseName || 'the golf course'} has been cancelled.`,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
      throw error;
    }
  };
  
  // Request to join a tee time - UPDATED to use userId as document ID
  export const requestToJoinTeeTime = async (
    teeTimeId: string, 
    userId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      // Run in a transaction to ensure consistency
      await runTransaction(db, async (transaction) => {
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new Error('Tee time not found');
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Check if tee time is open
        if (teeTimeData.status !== 'open') {
          throw new Error(`Cannot join a ${teeTimeData.status} tee time`);
        }
        
        // Check if user is already in the tee time
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', userId);
        const playerDoc = await transaction.get(playerRef);
        
        if (playerDoc.exists()) {
          throw new Error('You are already part of this tee time');
        }
        
        // Determine player status based on visibility
        let playerStatus: PlayerStatus = 'pending';
        
        // For public tee times, auto-confirm if not full
        if (teeTimeData.visibility === 'public' && (teeTimeData.currentPlayers || 0) < (teeTimeData.maxPlayers || 4)) {
          playerStatus = 'confirmed';
          
          // Update current players count
          transaction.update(teeTimeRef, {
            currentPlayers: (teeTimeData.currentPlayers || 0) + 1,
            updatedAt: serverTimestamp(),
            // Set to full if reaching max players
            ...(((teeTimeData.currentPlayers || 0) + 1 >= (teeTimeData.maxPlayers || 4)) ? { status: 'full' } : {}),
          });
        }
        
        // Add player to tee time using userId as the document ID
        transaction.set(playerRef, {
          userId: userId,
          status: playerStatus,
          joinedAt: serverTimestamp(),
        });
        
        // Add to user tee times (now as subcollection)
        const userTeeTimeRef = doc(collection(db, USER_TEE_TIMES_COLLECTION, userId, 'teeTimes'));
        transaction.set(userTeeTimeRef, {
          teeTimeId: teeTimeId,
          role: 'player',
          status: playerStatus,
        });
      });
    } catch (error) {
      console.error('Error requesting to join tee time:', error);
      throw error;
    }
  };
  
  // Approve a player's request to join
  export const approvePlayerRequest = async (
    teeTimeId: string, 
    playerId: string, 
    approverUserId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      await runTransaction(db, async (transaction) => {
        // Get the tee time
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new Error('Tee time not found');
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Verify approver is the creator
        if (teeTimeData.creatorId !== approverUserId) {
          throw new Error('Only the creator can approve requests');
        }
        
        // Check if tee time is full
        if ((teeTimeData.currentPlayers || 0) >= (teeTimeData.maxPlayers || 4)) {
          throw new Error('This tee time is already full');
        }
        
        // Get the player document directly using playerId
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', playerId);
        const playerDoc = await transaction.get(playerRef);
        
        if (!playerDoc.exists() || (playerDoc.data() || {}).status !== 'pending') {
          throw new Error('Player request not found');
        }
        
        // Update player status to confirmed
        transaction.update(playerRef, {
          status: 'confirmed',
        });
        
        // Update user-tee-time record
        const userTeeTimeQuery = query(
          collection(db, USER_TEE_TIMES_COLLECTION, playerId, 'teeTimes'),
          where('teeTimeId', '==', teeTimeId)
        );
        
        const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
        
        if (!userTeeTimeSnapshot.empty) {
          const userTeeTimeDocRef = doc(db, USER_TEE_TIMES_COLLECTION, playerId, 'teeTimes', userTeeTimeSnapshot.docs[0].id);
          transaction.update(userTeeTimeDocRef, {
            status: 'confirmed',
          });
        }
        
        // Update tee time player count and status
        const newPlayerCount = (teeTimeData.currentPlayers || 0) + 1;
        const updateData: any = {
          currentPlayers: newPlayerCount,
          updatedAt: serverTimestamp(),
        };
        
        // If reaching max players, update status to full
        if (newPlayerCount >= (teeTimeData.maxPlayers || 4)) {
          updateData.status = 'full';
        }
        
        transaction.update(teeTimeRef, updateData);
      });
    } catch (error) {
      console.error('Error approving player request:', error);
      throw error;
    }
  };
  
  // Remove a player from a tee time
  export const removePlayerFromTeeTime = async (
    teeTimeId: string, 
    playerId: string, 
    removerUserId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      
      await runTransaction(db, async (transaction) => {
        // Get the tee time
        const teeTimeDoc = await transaction.get(teeTimeRef);
        
        if (!teeTimeDoc.exists()) {
          throw new Error('Tee time not found');
        }
        
        const teeTimeData = teeTimeDoc.data() || {};
        
        // Verify remover is the creator or the player themselves
        if (teeTimeData.creatorId !== removerUserId && playerId !== removerUserId) {
          throw new Error('You do not have permission to remove this player');
        }
        
        // Cannot remove the creator
        if (playerId === teeTimeData.creatorId) {
          throw new Error('Cannot remove the creator from the tee time');
        }
        
        // Get the player document directly using playerId
        const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', playerId);
        const playerDoc = await transaction.get(playerRef);
        
        if (!playerDoc.exists()) {
          throw new Error('Player not found in this tee time');
        }
        
        const playerData = playerDoc.data() || {};
        
        // Only decrement player count if the player was confirmed
        let decrementPlayerCount = playerData.status === 'confirmed';
        
        // Delete the player record
        transaction.delete(playerRef);
        
        // Delete user-tee-time record
        const userTeeTimeQuery = query(
          collection(db, USER_TEE_TIMES_COLLECTION, playerId, 'teeTimes'),
          where('teeTimeId', '==', teeTimeId)
        );
        
        const userTeeTimeSnapshot = await getDocs(userTeeTimeQuery);
        
        if (!userTeeTimeSnapshot.empty) {
          const userTeeTimeDocRef = doc(db, USER_TEE_TIMES_COLLECTION, playerId, 'teeTimes', userTeeTimeSnapshot.docs[0].id);
          transaction.delete(userTeeTimeDocRef);
        }
        
        // Update tee time player count and status if needed
        if (decrementPlayerCount) {
          const newPlayerCount = Math.max((teeTimeData.currentPlayers || 1) - 1, 1); // Ensure never below 1
          
          const updateData: any = {
            currentPlayers: newPlayerCount,
            updatedAt: serverTimestamp(),
          };
          
          // If it was full, update status back to open
          if (teeTimeData.status === 'full') {
            updateData.status = 'open';
          }
          
          transaction.update(teeTimeRef, updateData);
        }
      });
    } catch (error) {
      console.error('Error removing player from tee time:', error);
      throw error;
    }
  };
  
  // Invite a player to a tee time by userId instead of email
  export const invitePlayerToTeeTime = async (
    teeTimeId: string,
    invitedUserId: string,
    inviterUserId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new Error('Tee time not found');
      }
      
      const teeTimeData = teeTimeDoc.data() || {};
      
      // Verify inviter is the creator
      if (teeTimeData.creatorId !== inviterUserId) {
        throw new Error('Only the creator can invite players');
      }
      
      // Check if tee time is full
      if (teeTimeData.status === 'full') {
        throw new Error('This tee time is already full');
      }
      
      // Get user profile to ensure they exist
      const userProfileRef = doc(db, 'users', invitedUserId);
      const userProfileDoc = await getDoc(userProfileRef);
      
      if (!userProfileDoc.exists()) {
        throw new Error('User not found');
      }
      
      // Check if user is already in the tee time
      const playerRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', invitedUserId);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        throw new Error('This player is already part of the tee time');
      }
      
      // Create a pending invitation
      await addDoc(collection(db, 'tee-time-invitations'), {
        teeTimeId,
        invitedUserId,
        invitedBy: inviterUserId,
        teeTimeName: teeTimeData.courseName || '',
        teeTimeDate: teeTimeData.dateTime || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      // Also automatically add the player to the tee time with pending status
      await setDoc(playerRef, {
        userId: invitedUserId,
        status: 'pending',
        joinedAt: serverTimestamp(),
        invitedBy: inviterUserId
      });
      
      // Add to invited user's tee times
      const userTeeTimeRef = doc(collection(db, USER_TEE_TIMES_COLLECTION, invitedUserId, 'teeTimes'));
      await setDoc(userTeeTimeRef, {
        teeTimeId: teeTimeId,
        role: 'player',
        status: 'pending',
        invitedBy: inviterUserId
      });
      
    } catch (error) {
      console.error('Error inviting player to tee time:', error);
      throw error;
    }
  };
  
  // Search users by name (new function)
  export const searchUsersByName = async (queryString: string): Promise<UserProfile[]> => {
    try {
      // Firebase doesn't support text search natively, so we'll need to use a workaround
      const usersRef = collection(db, 'users');
      // Renamed 'q' to 'queryRef' to avoid conflict with the imported 'query' function
      const queryRef = query(
        usersRef,
        orderBy('displayName'),
        // Use startAt and endAt for prefix search
        startAt(queryString),
        endAt(queryString + '\uf8ff'),
        limit(10)
      );
      
      const snapshot = await getDocs(queryRef);
      
      return snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          uid: doc.id,
          displayName: data.displayName || null,
          photoURL: data.photoURL || null,
          email: data.email || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          handicapIndex: data.handicapIndex || null,
          homeCourse: data.homeCourse || null,
          profileComplete: data.profileComplete || false,
          bio: data.bio || null
        };
      });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };
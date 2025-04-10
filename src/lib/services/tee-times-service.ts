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
    startAfter
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
  
  // Updated collection names to match Firestore rules
  const TEE_TIMES_COLLECTION = 'teeTimes';
  const TEE_TIME_PLAYERS_COLLECTION = 'teeTimes';
  const USER_TEE_TIMES_COLLECTION = 'users';
  
  // Helper function to convert Firestore data to TeeTime
  const convertToTeeTime = (doc: any): TeeTime => {
    const data = doc.data();
    return {
      id: doc.id,
      creatorId: data.creatorId,
      courseName: data.courseName,
      courseId: data.courseId,
      dateTime: data.dateTime?.toDate() || null,
      maxPlayers: data.maxPlayers,
      currentPlayers: data.currentPlayers,
      status: data.status,
      visibility: data.visibility,
      description: data.description || '',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  };
  
  // Create a new tee time
  export const createTeeTime = async (
    userId: string, 
    teeTimeData: TeeTimeFormData
  ): Promise<string> => {
    try {
      // Combine date and time
      const dateTime = new Date(teeTimeData.date);
      const [hours, minutes] = teeTimeData.time.split(':').map(Number);
      dateTime.setHours(hours, minutes);
      
      // First, create the tee time document
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
      
      // Add the creator as a confirmed player (now as a subcollection)
      await addDoc(collection(db, TEE_TIMES_COLLECTION, teeTimeRef.id, 'players'), {
        userId: userId,
        status: 'confirmed' as PlayerStatus,
        joinedAt: serverTimestamp(),
        isCreator: true
      });
      
      // Add reference to user's tee times (now as a subcollection)
      await addDoc(collection(db, USER_TEE_TIMES_COLLECTION, userId, 'teeTimes'), {
        teeTimeId: teeTimeRef.id,
        role: 'creator',
        status: 'confirmed' as PlayerStatus,
      });
      
      // Create a post
      const postRef = await addDoc(collection(db, 'posts'), {
        authorId: userId,
        content: `I'm hosting a tee time at ${teeTimeData.courseName} on ${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Looking for ${teeTimeData.maxPlayers - 1} more players!`,
        postType: 'regular', // Start as a regular post
        visibility: teeTimeData.visibility === 'private' ? 'private' : 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likes: 0,
        comments: 0,
        likedBy: []
      });
      
      // After a small delay, update the post to be a tee-time post
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'posts', postRef.id), {
            postType: 'tee-time',
            teeTimeId: teeTimeRef.id,
            courseName: teeTimeData.courseName,
            maxPlayers: teeTimeData.maxPlayers
          });
        } catch (updateError) {
          console.error('Error updating post type:', updateError);
        }
      }, 1000);
      
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
        const data = doc.data();
        return {
          userId: data.userId,
          status: data.status,
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
      const teeTimeIds = userTeeTimesSnapshot.docs.map(doc => doc.data().teeTimeId);
      
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
      const teeTimeData = teeTimeDoc.data();
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
        if (updates.maxPlayers < teeTimeData.currentPlayers) {
          throw new Error('Cannot reduce max players below current player count');
        }
        updateData.maxPlayers = updates.maxPlayers;
        
        // Update status if necessary
        if (teeTimeData.status === 'full' && updates.maxPlayers > teeTimeData.currentPlayers) {
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
              : new Date(teeTimeData.dateTime.toDate()).toLocaleDateString()
          } at ${
            updateData.dateTime 
              ? updateData.dateTime.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
              : new Date(teeTimeData.dateTime.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          }. Looking for ${(updates.maxPlayers || teeTimeData.maxPlayers) - teeTimeData.currentPlayers} more players!`
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
      const teeTimeData = teeTimeDoc.data();
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
          content: `This tee time at ${teeTimeData.courseName} has been cancelled.`,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error cancelling tee time:', error);
      throw error;
    }
  };
  
  // Request to join a tee time
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
        
        const teeTimeData = teeTimeDoc.data();
        
        // Check if tee time is open
        if (teeTimeData.status !== 'open') {
          throw new Error(`Cannot join a ${teeTimeData.status} tee time`);
        }
        
        // Check if user is already in the tee time
        const playerQuery = query(
          collection(db, TEE_TIMES_COLLECTION, teeTimeId, 'players'),
          where('userId', '==', userId)
        );
        
        const playerSnapshot = await getDocs(playerQuery);
        
        if (!playerSnapshot.empty) {
          throw new Error('You are already part of this tee time');
        }
        
        // Determine player status based on visibility
        let playerStatus: PlayerStatus = 'pending';
        
        // For public tee times, auto-confirm if not full
        if (teeTimeData.visibility === 'public' && teeTimeData.currentPlayers < teeTimeData.maxPlayers) {
          playerStatus = 'confirmed';
          
          // Update current players count
          transaction.update(teeTimeRef, {
            currentPlayers: teeTimeData.currentPlayers + 1,
            updatedAt: serverTimestamp(),
            // Set to full if reaching max players
            ...(teeTimeData.currentPlayers + 1 >= teeTimeData.maxPlayers ? { status: 'full' } : {}),
          });
        }
        
        // Add player to tee time (now as subcollection)
        const playerRef = doc(collection(db, TEE_TIMES_COLLECTION, teeTimeId, 'players'));
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
        
        const teeTimeData = teeTimeDoc.data();
        
        // Verify approver is the creator
        if (teeTimeData.creatorId !== approverUserId) {
          throw new Error('Only the creator can approve requests');
        }
        
        // Check if tee time is full
        if (teeTimeData.currentPlayers >= teeTimeData.maxPlayers) {
          throw new Error('This tee time is already full');
        }
        
        // Find the player request
        const playerQuery = query(
          collection(db, TEE_TIMES_COLLECTION, teeTimeId, 'players'),
          where('userId', '==', playerId),
          where('status', '==', 'pending')
        );
        
        const playerSnapshot = await getDocs(playerQuery);
        
        if (playerSnapshot.empty) {
          throw new Error('Player request not found');
        }
        
        const playerDocRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', playerSnapshot.docs[0].id);
        
        // Update player status to confirmed
        transaction.update(playerDocRef, {
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
        const newPlayerCount = teeTimeData.currentPlayers + 1;
        const updateData: any = {
          currentPlayers: newPlayerCount,
          updatedAt: serverTimestamp(),
        };
        
        // If reaching max players, update status to full
        if (newPlayerCount >= teeTimeData.maxPlayers) {
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
        
        const teeTimeData = teeTimeDoc.data();
        
        // Verify remover is the creator or the player themselves
        if (teeTimeData.creatorId !== removerUserId && playerId !== removerUserId) {
          throw new Error('You do not have permission to remove this player');
        }
        
        // Cannot remove the creator
        if (playerId === teeTimeData.creatorId) {
          throw new Error('Cannot remove the creator from the tee time');
        }
        
        // Find the player record
        const playerQuery = query(
          collection(db, TEE_TIMES_COLLECTION, teeTimeId, 'players'),
          where('userId', '==', playerId)
        );
        
        const playerSnapshot = await getDocs(playerQuery);
        
        if (playerSnapshot.empty) {
          throw new Error('Player not found in this tee time');
        }
        
        const playerDoc = playerSnapshot.docs[0];
        const playerData = playerDoc.data();
        const playerDocRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId, 'players', playerDoc.id);
        
        // Only decrement player count if the player was confirmed
        let decrementPlayerCount = playerData.status === 'confirmed';
        
        // Delete the player record
        transaction.delete(playerDocRef);
        
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
          const newPlayerCount = Math.max(teeTimeData.currentPlayers - 1, 1); // Ensure never below 1
          
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
  
  // Invite a player to a tee time
  export const invitePlayerToTeeTime = async (
    teeTimeId: string,
    email: string,
    inviterUserId: string
  ): Promise<void> => {
    try {
      const teeTimeRef = doc(db, TEE_TIMES_COLLECTION, teeTimeId);
      const teeTimeDoc = await getDoc(teeTimeRef);
      
      if (!teeTimeDoc.exists()) {
        throw new Error('Tee time not found');
      }
      
      const teeTimeData = teeTimeDoc.data();
      
      // Verify inviter is the creator
      if (teeTimeData.creatorId !== inviterUserId) {
        throw new Error('Only the creator can invite players');
      }
      
      // Check if tee time is full
      if (teeTimeData.status === 'full') {
        throw new Error('This tee time is already full');
      }
      
      // Create a pending invitation
      await addDoc(collection(db, 'tee-time-invitations'), {
        teeTimeId,
        email,
        invitedBy: inviterUserId,
        teeTimeName: teeTimeData.courseName,
        teeTimeDate: teeTimeData.dateTime,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      // In a real app, you would send an email here with a link to register/login and accept the invitation
      
    } catch (error) {
      console.error('Error inviting player to tee time:', error);
      throw error;
    }
  };
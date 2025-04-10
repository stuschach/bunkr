import { 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    serverTimestamp, 
    Timestamp,
    onSnapshot
  } from 'firebase/firestore';
  import { db, auth } from './config';
  import { UserProfile } from '@/types/auth';
  import { Chat, Message } from '@/types/messages';
  
  /**
   * Get all chats for the current user
   */
  export const getUserChats = async (): Promise<Chat[]> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to view messages');
    }
    
    try {
      // Query chats where the current user is a participant
      const chatsQuery = query(
        collection(db, 'messages'),
        where(`participants.${auth.currentUser.uid}`, '==', true),
        orderBy('updatedAt', 'desc')
      );
      
      const chatsSnapshot = await getDocs(chatsQuery);
      const chats: Chat[] = [];
      
      // Process each chat
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data() as Omit<Chat, 'id'>;
        
        // Get profile information for all participants
        const participantIds = Object.keys(chatData.participants).filter(id => id !== auth.currentUser!.uid);
        const participantProfiles: { [userId: string]: UserProfile } = {};
        
        for (const participantId of participantIds) {
          const userDocRef = doc(db, 'users', participantId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            participantProfiles[participantId] = userDoc.data() as UserProfile;
          }
        }
        
        chats.push({
          id: chatDoc.id,
          ...chatData,
          participantProfiles
        });
      }
      
      return chats;
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw new Error('Failed to load conversations');
    }
  };
  
  /**
   * Get a chat by ID
   */
  export const getChatById = async (chatId: string): Promise<Chat | null> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to view messages');
    }
    
    try {
      const chatDoc = await getDoc(doc(db, 'messages', chatId));
      
      if (!chatDoc.exists()) {
        return null;
      }
      
      const chatData = chatDoc.data() as Omit<Chat, 'id'>;
      
      // Security check - make sure current user is a participant
      if (!chatData.participants[auth.currentUser.uid]) {
        throw new Error('You do not have permission to view this conversation');
      }
      
      // Get profile information for all participants
      const participantIds = Object.keys(chatData.participants).filter(id => id !== auth.currentUser!.uid);
      const participantProfiles: { [userId: string]: UserProfile } = {};
      
      for (const participantId of participantIds) {
        const userDocRef = doc(db, 'users', participantId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          participantProfiles[participantId] = userDoc.data() as UserProfile;
        }
      }
      
      return {
        id: chatDoc.id,
        ...chatData,
        participantProfiles
      };
    } catch (error) {
      console.error('Error fetching chat:', error);
      throw new Error('Failed to load conversation');
    }
  };
  
  /**
   * Get or create a chat with another user
   */
  export const getOrCreateChat = async (otherUserId: string): Promise<Chat> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to send messages');
    }
    
    if (otherUserId === auth.currentUser.uid) {
      throw new Error('You cannot message yourself');
    }
    
    try {
      // Check if a chat already exists between these users
      const existingChatQuery = query(
        collection(db, 'messages'),
        where(`participants.${auth.currentUser.uid}`, '==', true),
        where(`participants.${otherUserId}`, '==', true)
      );
      
      const existingChatSnapshot = await getDocs(existingChatQuery);
      
      // If a chat exists, return it
      if (!existingChatSnapshot.empty) {
        const chatDoc = existingChatSnapshot.docs[0];
        const chatData = chatDoc.data() as Omit<Chat, 'id'>;
        
        // Get the other user's profile
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        const participantProfiles: { [userId: string]: UserProfile } = {};
        
        if (otherUserDoc.exists()) {
          participantProfiles[otherUserId] = otherUserDoc.data() as UserProfile;
        }
        
        return {
          id: chatDoc.id,
          ...chatData,
          participantProfiles
        };
      }
      
      // If no chat exists, create one
      const newChatData = {
        participants: {
          [auth.currentUser.uid]: true,
          [otherUserId]: true
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isGroupChat: false
      };
      
      const newChatRef = await addDoc(collection(db, 'messages'), newChatData);
      
      // Get the other user's profile
      const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
      const participantProfiles: { [userId: string]: UserProfile } = {};
      
      if (otherUserDoc.exists()) {
        participantProfiles[otherUserId] = otherUserDoc.data() as UserProfile;
      }
      
      return {
        id: newChatRef.id,
        ...newChatData,
        participantProfiles
      };
    } catch (error) {
      console.error('Error getting or creating chat:', error);
      throw new Error('Failed to start conversation');
    }
  };
  
  /**
   * Get messages for a specific chat
   */
  export const getChatMessages = async (chatId: string, messageLimit: number = 50): Promise<Message[]> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to view messages');
    }
    
    try {
      // Verify the user is a participant in this chat
      const chatDoc = await getDoc(doc(db, 'messages', chatId));
      
      if (!chatDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const chatData = chatDoc.data();
      
      if (!chatData.participants[auth.currentUser.uid]) {
        throw new Error('You do not have permission to view this conversation');
      }
      
      // Query messages for this chat
      const messagesQuery = query(
        collection(db, 'messages', chatId, 'thread'),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      // Process messages
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        chatId
      })) as Message[];
      
      // Sort messages by creation date (oldest first)
      return messages.reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error('Failed to load messages');
    }
  };
  
  /**
   * Subscribe to messages in a chat
   */
  export const subscribeToChatMessages = (
    chatId: string, 
    callback: (messages: Message[]) => void
  ): () => void => {
    if (!auth.currentUser) {
      return () => {};
    }
    
    const messagesQuery = query(
      collection(db, 'messages', chatId, 'thread'),
      orderBy('createdAt', 'asc')
    );
    
    // Create a snapshot listener that will update in real-time
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        chatId
      })) as Message[];
      
      callback(messages);
    }, (error) => {
      console.error('Error in messages subscription:', error);
    });
    
    return unsubscribe;
  };
  
  /**
   * Send a message
   */
  export const sendMessage = async (chatId: string, content: string): Promise<Message> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to send messages');
    }
    
    if (!content.trim()) {
      throw new Error('Message cannot be empty');
    }
    
    try {
      // Verify the user is a participant in this chat
      const chatDoc = await getDoc(doc(db, 'messages', chatId));
      
      if (!chatDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const chatData = chatDoc.data();
      
      if (!chatData.participants[auth.currentUser.uid]) {
        throw new Error('You do not have permission to send messages in this conversation');
      }
      
      // Prepare message data
      const messageData = {
        senderId: auth.currentUser.uid,
        content: content.trim(),
        createdAt: serverTimestamp(),
        readBy: { [auth.currentUser.uid]: true }
      };
      
      // Add the message to the thread
      const messageRef = await addDoc(collection(db, 'messages', chatId, 'thread'), messageData);
      
      // Update the chat with the last message
      await updateDoc(doc(db, 'messages', chatId), {
        lastMessage: {
          content: content.trim(),
          senderId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
      
      // Return the sent message
      return {
        id: messageRef.id,
        ...messageData,
        chatId
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  };
  
  /**
   * Mark messages as read
   */
  export const markMessagesAsRead = async (chatId: string, messageIds: string[]): Promise<void> => {
    if (!auth.currentUser || messageIds.length === 0) {
      return;
    }
    
    try {
      // Update each message
      const updatePromises = messageIds.map(messageId => 
        updateDoc(doc(db, 'messages', chatId, 'thread', messageId), {
          [`readBy.${auth.currentUser!.uid}`]: true
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  };
  
  /**
   * Delete a message (soft delete)
   */
  export const deleteMessage = async (chatId: string, messageId: string): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to delete messages');
    }
    
    try {
      // Get the message to check if user is the sender
      const messageDoc = await getDoc(doc(db, 'messages', chatId, 'thread', messageId));
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Only allow deletion if user is the sender
      if (messageData.senderId !== auth.currentUser.uid) {
        throw new Error('You can only delete your own messages');
      }
      
      // Soft delete by updating the message
      await updateDoc(doc(db, 'messages', chatId, 'thread', messageId), {
        deleted: true,
        content: 'This message has been deleted'
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  };
  
  /**
   * Search for users to start a conversation with
   */
  export const searchUsers = async (searchTerm: string, maxResults: number = 10): Promise<UserProfile[]> => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to search users');
    }
    
    if (!searchTerm.trim()) {
      return [];
    }
    
    try {
      // Query for users whose display name contains the search term
      const usersQuery = query(
        collection(db, 'users'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(maxResults)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      // Filter out the current user
      return usersSnapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(profile => profile.uid !== auth.currentUser!.uid);
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search users');
    }
  };
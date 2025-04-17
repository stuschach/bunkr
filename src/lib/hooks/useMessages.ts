// src/lib/hooks/useMessages.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  updateDoc,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Chat, Message } from '@/types/messages';
import { cacheService } from '@/lib/services/CacheService';

export function useMessages() {
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use refs to avoid stale closures
  const functionsRef = useRef<Functions | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  
  // Initialize Firebase Functions
  useEffect(() => {
    try {
      functionsRef.current = getFunctions();
      setIsInitialized(true);
    } catch (err) {
      console.error('Error initializing Firebase Functions:', err);
      setError('Failed to initialize messaging system');
    }
  }, []);
  
  // Get all chats for the current user
  const getChats = useCallback(async () => {
    if (!user || !isInitialized) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      // We'll rely on the real-time listener to populate this
      return chats;
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load your conversations');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, chats, isInitialized]);

  // Get chat by ID with caching
  const getChatById = useCallback(async (chatId: string) => {
    if (!user || !isInitialized) {
      console.log('User not authenticated or system not initialized');
      return null;
    }
    
    try {
      // Try cache first
      const cachedChat = await cacheService.get<Chat>(`chat_${chatId}`);
      if (cachedChat) {
        console.log('Using cached chat data for', chatId);
        return cachedChat;
      }
      
      // Find it in local state for efficiency
      const localChat = chats.find(c => c.id === chatId);
      if (localChat) {
        // Store in cache for future use
        await cacheService.set(`chat_${chatId}`, localChat, { ttl: 5 * 60 * 1000 }); // 5 min TTL
        return localChat;
      }
      
      // Fetch from database with error handling
      try {
        const chatDocRef = doc(db, 'messages', chatId);
        const chatDoc = await getDoc(chatDocRef);
        
        if (!chatDoc.exists()) {
          console.error('Chat not found');
          return null;
        }
        
        const chatData = chatDoc.data();
        
        // Verify the user is a participant
        if (!chatData.participantArray?.includes(user.uid) && 
            !chatData.participants?.[user.uid]) {
          console.error('User is not a participant in this chat');
          return null;
        }
        
        const chat = {
          id: chatDoc.id,
          ...chatData
        } as Chat;
        
        // Store in cache
        await cacheService.set(`chat_${chatId}`, chat, { ttl: 5 * 60 * 1000 }); // 5 min TTL
        
        return chat;
      } catch (firestoreErr) {
        console.error('Firestore error getting chat by ID:', firestoreErr);
        return null;
      }
    } catch (err) {
      console.error('Error getting chat by ID:', err);
      return null;
    }
  }, [user, chats, isInitialized]);

  // Get or create a chat with another user
  const getOrCreateChat = useCallback(async (otherUserId: string) => {
    if (!user || !isInitialized || !functionsRef.current) {
      console.error('User not authenticated or system not initialized');
      return null;
    }
    
    try {
      console.log(`Getting or creating chat with user ${otherUserId}`);
      const getOrCreateChatFn = httpsCallable(functionsRef.current, 'getOrCreateChat');
      const result = await getOrCreateChatFn({ otherUserId });
      console.log('Chat result:', result.data);
      return result.data as Chat;
    } catch (err) {
      console.error('Error getting or creating chat:', err);
      setError('Failed to start conversation');
      return null;
    }
  }, [user, isInitialized]);

  // Get messages for a specific chat
  const getMessages = useCallback(async (chatId: string, limit = 50) => {
    if (!user || !isInitialized || !functionsRef.current) {
      console.error('User not authenticated or system not initialized');
      return [];
    }
    
    setIsLoadingMessages(true);
    
    try {
      // Check cache first
      const cacheKey = `messages_${chatId}_${limit}`;
      const cachedMessages = await cacheService.get<Message[]>(cacheKey);
      
      if (cachedMessages) {
        console.log(`Using cached messages for chat ${chatId}`);
        setIsLoadingMessages(false);
        return cachedMessages;
      }
      
      console.log(`Fetching messages for chat ${chatId}`);
      try {
        const getMessagesFn = httpsCallable(functionsRef.current, 'getChatMessages');
        const result = await getMessagesFn({ chatId, pageSize: limit });
        const data = result.data as { messages: Message[], totalCount: number };
        
        // Cache the result with a short TTL
        await cacheService.set(cacheKey, data.messages, { ttl: 60 * 1000 }); // 1 minute TTL
        
        return data.messages;
      } catch (funcErr) {
        console.error('Cloud function error fetching messages:', funcErr);
        setError('Failed to load messages');
        return [];
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
      return [];
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, isInitialized]);

  // Subscribe to messages in a chat
  const subscribeToMessages = useCallback((chatId: string, callback: (messages: Message[]) => void) => {
    if (!user || !isInitialized) {
      console.error('User not authenticated or system not initialized');
      return () => {};
    }
    
    console.log(`Setting up message subscription for chat ${chatId}`);
    
    // For real-time chat, we still use Firestore listeners
    // First get the chat document to determine sharding
    const chatDocRef = doc(db, 'messages', chatId);
    
    // Define a variable to hold the unsubscribe function
    let unsubscribeFunction = () => {};
    
    getDoc(chatDocRef)
      .then(docSnapshot => {
        if (!docSnapshot.exists()) {
          console.log(`Chat ${chatId} does not exist`);
          return;
        }
        
        try {
          const chatData = docSnapshot.data();
          
          // Verify the user is a participant
          if (!chatData.participantArray?.includes(user.uid) && 
              !chatData.participants?.[user.uid]) {
            console.error('User is not a participant in this chat');
            return;
          }
          
          const messageCount = chatData.messageCount || 0;
          const shardId = Math.floor(messageCount / 500);
          const collectionName = shardId > 0 ? `thread_${shardId}` : 'thread';
          
          console.log(`Listening to messages in collection: ${collectionName}`);
          
          // Set up the listener on the appropriate collection
          const messagesQuery = query(
            collection(db, 'messages', chatId, collectionName),
            where('createdAt', '!=', null) // Ensure we get messages with timestamps
          );
          
          const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            try {
              const messages = snapshot.docs
                .map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  chatId
                } as Message))
                .sort((a, b) => {
                  // Sort by creation date
                  const aTime = a.createdAt instanceof Date ? a.createdAt : 
                               a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                  const bTime = b.createdAt instanceof Date ? b.createdAt : 
                               b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                  
                  return aTime.getTime() - bTime.getTime();
                });
              
              console.log(`Received ${messages.length} messages in real-time for chat ${chatId}`);
              
              // Update the cache with the latest messages
              cacheService.set(`messages_${chatId}_50`, messages, { ttl: 60 * 1000 });
              
              callback(messages);
            } catch (sortErr) {
              console.error('Error processing messages in subscription:', sortErr);
            }
          }, (error) => {
            console.error(`Error in messages subscription for chat ${chatId}:`, error);
          });
          
          // Store the unsubscribe function
          unsubscribeFunction = unsubscribe;
        } catch (processErr) {
          console.error('Error processing chat data for subscription:', processErr);
        }
      })
      .catch(error => {
        console.error(`Failed to set up message subscription for chat ${chatId}:`, error);
      });
    
    // Return the unsubscribe function directly
    return () => {
      console.log(`Cleaning up message subscription for chat ${chatId}`);
      unsubscribeFunction();
    };
  }, [user, isInitialized]);

  // Send a message
  const sendMessage = useCallback(async (chatId: string, content: string) => {
    if (!user || !isInitialized || !functionsRef.current) {
      console.error('User not authenticated or system not initialized');
      return null;
    }
    
    if (!content.trim()) {
      console.error('Message content is empty');
      return null;
    }
    
    setIsSendingMessage(true);
    console.log(`Sending message to chat ${chatId}`);
    
    try {
      const sendMessageFn = httpsCallable(functionsRef.current, 'sendMessage');
      const result = await sendMessageFn({ chatId, content });
      console.log('Message sent successfully:', result.data);
      
      // Immediately update local chat data to ensure the sender's unread counter is 0
      setChats(prevChats => 
        prevChats.map(chat => {
          if (chat.id === chatId) {
            return {
              ...chat,
              unreadCounters: {
                ...(chat.unreadCounters || {}),
                [user.uid]: 0
              }
            };
          }
          return chat;
        })
      );
      
      return result.data;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return null;
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, isInitialized, setChats]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    if (!user || !isInitialized || !functionsRef.current || messageIds.length === 0) {
      return false;
    }
    
    console.log(`Marking ${messageIds.length} messages as read in chat ${chatId}`);
    
    try {
      // Call the cloud function to reset the unread counter
      const markChatAsReadFn = httpsCallable(functionsRef.current, 'markChatAsRead');
      await markChatAsReadFn({ chatId });
      
      // Also update the local chat objects to reflect zero unread messages
      setChats(prevChats => 
        prevChats.map(chat => {
          if (chat.id === chatId) {
            return {
              ...chat,
              unreadCounters: {
                ...(chat.unreadCounters || {}),
                [user.uid]: 0
              }
            };
          }
          return chat;
        })
      );
      
      // Update local Firestore document as well (belt and suspenders approach)
      try {
        await updateDoc(doc(db, 'messages', chatId), {
          [`unreadCounters.${user.uid}`]: 0
        });
      } catch (updateErr) {
        console.error('Error updating unread counter in Firestore:', updateErr);
        // Continue even if this fails, as the cloud function should have done this
      }
      
      // Update the cache to reflect the changes
      const cacheKey = `messages_${chatId}_50`;
      const cachedMessages = await cacheService.get<Message[]>(cacheKey);
      if (cachedMessages) {
        const updatedCachedMessages = cachedMessages.map(msg => {
          if (messageIds.includes(msg.id)) {
            return {
              ...msg,
              readBy: { ...msg.readBy, [user.uid]: true }
            };
          }
          return msg;
        });
        
        await cacheService.set(cacheKey, updatedCachedMessages, { ttl: 60 * 1000 });
      }
      
      // Update chat in cache too
      const chatCacheKey = `chat_${chatId}`;
      const cachedChat = await cacheService.get<Chat>(chatCacheKey);
      if (cachedChat) {
        const updatedCachedChat = {
          ...cachedChat,
          unreadCounters: {
            ...(cachedChat.unreadCounters || {}),
            [user.uid]: 0
          }
        };
        
        await cacheService.set(chatCacheKey, updatedCachedChat, { ttl: 5 * 60 * 1000 });
      }
      
      return true;
    } catch (err) {
      console.error('Error marking messages as read:', err);
      return false;
    }
  }, [user, isInitialized, setChats]);

  // Delete a message
  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    if (!user || !isInitialized) {
      console.error('User not authenticated or system not initialized');
      return false;
    }
    
    try {
      // We'll implement a soft delete for now
      // Determine which thread collection to use (based on sharding)
      const chatDocRef = doc(db, 'messages', chatId);
      const chatDoc = await getDoc(chatDocRef);
      
      if (!chatDoc.exists()) {
        console.error('Chat not found');
        return false;
      }
      
      const chatData = chatDoc.data();
      const messageCount = chatData.messageCount || 0;
      const shardId = Math.floor(messageCount / 500);
      const collectionName = shardId > 0 ? `thread_${shardId}` : 'thread';
      
      // Get the message to check ownership
      const messageRef = doc(db, 'messages', chatId, collectionName, messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        console.error('Message not found');
        return false;
      }
      
      const messageData = messageDoc.data();
      
      // Verify the user owns this message
      if (messageData.senderId !== user.uid) {
        console.error('Cannot delete message: not the sender');
        return false;
      }
      
      // Perform soft delete by updating the message
      await updateDoc(messageRef, {
        deleted: true,
        content: 'This message has been deleted'
      });
      
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      return false;
    }
  }, [user, isInitialized]);

  // Search for users to message with better error handling
  const searchUsers = useCallback(async (searchTerm: string, maxResults: number = 10) => {
    if (!user || !isInitialized || !functionsRef.current) {
      console.error('User not authenticated or system not initialized');
      return [];
    }
    
    if (!searchTerm.trim()) return [];
    
    console.log(`Searching for users with term: "${searchTerm}"`);
    
    try {
      const searchUsersFn = httpsCallable(functionsRef.current, 'searchUsers');
      const result = await searchUsersFn({ query: searchTerm, limit: maxResults });
      
      const data = result.data as { users: any[] };
      console.log(`Found ${data.users.length} users matching "${searchTerm}"`);
      
      return data.users;
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      return [];
    }
  }, [user, isInitialized]);

  // Initialize with real-time chat updates
  useEffect(() => {
    // Clear any previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Only set up listener when auth is completed and user is logged in
    if (authLoading || !user || !isInitialized) {
      return;
    }
    
    setIsLoading(true);
    console.log('Setting up real-time chat listener');
    
    try {
      // Set up real-time listener for chat list only
      const chatsQuery = query(
        collection(db, 'messages'),
        where('participantArray', 'array-contains', user.uid)
      );
      
      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        try {
          // Process chat data
          const chatsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Chat[];
          
          // Sort by most recent first
          chatsData.sort((a, b) => {
            try {
              const aTime = a.updatedAt instanceof Date ? a.updatedAt : 
                          a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
              const bTime = b.updatedAt instanceof Date ? b.updatedAt : 
                          b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
              
              return bTime.getTime() - aTime.getTime();
            } catch (sortErr) {
              console.error('Error sorting chats:', sortErr);
              return 0;
            }
          });
          
          console.log(`Received ${chatsData.length} chats in real-time`);
          
          // Cache each chat
          chatsData.forEach(chat => {
            cacheService.set(`chat_${chat.id}`, chat, { ttl: 5 * 60 * 1000 });
          });
          
          setChats(chatsData);
        } catch (error) {
          console.error('Error processing chats:', error);
          setError('Failed to process conversations');
        } finally {
          setIsLoading(false);
        }
      }, (error) => {
        console.error('Error in chats subscription:', error);
        setIsLoading(false);
        setError('Failed to load conversations');
      });
      
      // Store unsubscribe function in ref
      unsubscribeRef.current = unsubscribe;
      
    } catch (setupErr) {
      console.error('Error setting up chat listener:', setupErr);
      setIsLoading(false);
      setError('Failed to initialize messaging');
    }
    
    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, authLoading, isInitialized]);

  return {
    chats,
    isLoading,
    error,
    isSendingMessage,
    isLoadingMessages,
    isInitialized,
    getChats,
    getChatById,
    getOrCreateChat,
    getMessages,
    subscribeToMessages,
    sendMessage,
    markMessagesAsRead,
    deleteMessage,
    searchUsers,
    setChats // Expose this to allow direct updates for optimistic UI
  };
}
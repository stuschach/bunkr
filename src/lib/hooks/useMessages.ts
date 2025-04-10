import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Chat, Message, MessageAttachment } from '@/types/messages';
import { UserProfile } from '@/types/auth';
import { 
  getUserChats,
  getOrCreateChat as getOrCreateChatFirebase,
  getChatMessages,
  subscribeToChatMessages,
  sendMessage as sendMessageFirebase,
  markMessagesAsRead as markMessagesAsReadFirebase,
  deleteMessage as deleteMessageFirebase,
  searchUsers as searchUsersFirebase,
  getChatById as getChatByIdFirebase
} from '@/lib/firebase/messages';

export function useMessages() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to get all chats for the current user
  const getChats = useCallback(async () => {
    if (!user) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      const chatsList = await getUserChats();
      setChats(chatsList);
      return chatsList;
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load your conversations');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Function to get chat by ID
  const getChatById = useCallback(async (chatId: string) => {
    if (!user) throw new Error('You must be logged in to view messages');
    
    try {
      return await getChatByIdFirebase(chatId);
    } catch (err) {
      console.error('Error getting chat by ID:', err);
      throw new Error('Failed to load conversation');
    }
  }, [user]);

  // Function to get or create a chat with another user
  const getOrCreateChat = useCallback(async (otherUserId: string) => {
    if (!user) throw new Error('You must be logged in to send messages');
    if (otherUserId === user.uid) throw new Error('You cannot message yourself');
    
    try {
      const chat = await getOrCreateChatFirebase(otherUserId);
      
      // Update the chats list if this is a new chat
      const chatExists = chats.some(c => c.id === chat.id);
      if (!chatExists) {
        setChats(prev => [chat, ...prev]);
      }
      
      return chat;
    } catch (err) {
      console.error('Error getting or creating chat:', err);
      throw new Error('Failed to start conversation');
    }
  }, [user, chats]);

  // Function to get messages for a specific chat
  const getMessages = useCallback(async (chatId: string, messageLimit: number = 50) => {
    if (!user) return [];
    
    try {
      return await getChatMessages(chatId, messageLimit);
    } catch (err) {
      console.error('Error fetching messages:', err);
      throw new Error('Failed to load messages');
    }
  }, [user]);

  // Function to listen for new messages in a chat
  const subscribeToMessages = useCallback((chatId: string, callback: (messages: Message[]) => void) => {
    if (!user) return () => {};
    
    return subscribeToChatMessages(chatId, callback);
  }, [user]);

  // Function to send a message
  const sendMessage = useCallback(async (chatId: string, content: string, attachments?: MessageAttachment[]) => {
    if (!user) throw new Error('You must be logged in to send messages');
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      throw new Error('Message cannot be empty');
    }
    
    try {
      return await sendMessageFirebase(chatId, content);
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error('Failed to send message');
    }
  }, [user]);

  // Function to mark messages as read
  const markMessagesAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;
    
    try {
      await markMessagesAsReadFirebase(chatId, messageIds);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [user]);

  // Function to delete a message
  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    if (!user) throw new Error('You must be logged in to delete messages');
    
    try {
      await deleteMessageFirebase(chatId, messageId);
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      throw new Error('Failed to delete message');
    }
  }, [user]);

  // Function to search for users to start a conversation with
  const searchUsers = useCallback(async (searchTerm: string, maxResults: number = 10) => {
    if (!user) throw new Error('You must be logged in to search users');
    if (!searchTerm.trim()) return [];
    
    try {
      return await searchUsersFirebase(searchTerm, maxResults);
    } catch (err) {
      console.error('Error searching users:', err);
      throw new Error('Failed to search users');
    }
  }, [user]);

  // Initialize by loading chats
  useEffect(() => {
    if (user) {
      getChats();
    } else {
      setChats([]); // Clear chats when user logs out
    }
  }, [user, getChats]);

  return {
    chats,
    isLoading,
    error,
    getChats,
    getChatById,
    getOrCreateChat,
    getMessages,
    subscribeToMessages,
    sendMessage,
    markMessagesAsRead,
    deleteMessage,
    searchUsers
  };
}
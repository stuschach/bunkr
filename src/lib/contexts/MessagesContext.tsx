// src/lib/contexts/MessagesContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { MessagingService } from '@/lib/services/MessagingService';
import { 
  Chat, 
  Message, 
  SimplifiedUserProfile, 
  UnreadCounts,
  MessageBatch
} from '@/types/messages';
import { PAGINATION } from '../constants';
import { safeTimestampToDate, safeToFirestoreTimestamp } from '@/lib/utils/timestamp-utils';
import { getFunctions, Functions, HttpsCallableResult } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';
import { Toast, ToastProps } from '@/components/common/feedback/Toast';

// Toast function implementation without redeclaring messagingService
interface ToastConfig extends Omit<ToastProps, 'open' | 'onClose'> {
  action?: React.ReactNode;
}

// Simple toast function implementation
function showToast(options: ToastConfig) {
  // In a real implementation, this would add the toast to a context/state
  console.log('Toast:', options);
  // For now, this is just a stub that logs the toast
  // The actual Toast component would be rendered elsewhere
}

// Initialize messaging service
const messagingService = MessagingService.getInstance();

// Define the context shape
// Extend Message type to include optimistic message properties
interface OptimisticMessage extends Message {
  isOptimistic?: boolean;
}

interface MessagesContextType {
  // Data
  chats: Chat[];
  selectedChatId: string | null;
  selectedChat: Chat | null;
  messages: Message[];
  unreadCounts: UnreadCounts;
  hasMoreMessages: boolean;
  
  // Loading states
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  isSearchingUsers: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  selectChat: (chatId: string | null) => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
  markMessagesAsRead: (messageIds: string[]) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  loadMoreMessages: () => Promise<boolean>;
  refreshChats: () => Promise<void>;
  searchUsers: (query: string) => Promise<SimplifiedUserProfile[]>;
  startChatWithUser: (userId: string) => Promise<string | null>;
  clearError: () => void;
  setError: (error: string | null) => void;
  retryFailedMessages: () => Promise<void>;
}

// Create the context with default values
const MessagesContext = createContext<MessagesContextType>({
  // Default values
  chats: [],
  selectedChatId: null,
  selectedChat: null,
  messages: [],
  unreadCounts: { totalUnread: 0, unreadByChat: {} },
  hasMoreMessages: false,
  
  isLoadingChats: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  isSearchingUsers: false,
  
  error: null,
  
  // No-op functions
  selectChat: async () => {},
  sendMessage: async () => false,
  markMessagesAsRead: async () => false,
  deleteMessage: async () => false,
  loadMoreMessages: async () => false,
  refreshChats: async () => {},
  searchUsers: async () => [],
  startChatWithUser: async () => null,
  clearError: () => {},
  setError: () => {},
  retryFailedMessages: async () => {}
});

// Provider props
interface MessagesProviderProps {
  children: ReactNode;
}

// Retry utility function
const retryOperation = async <T,>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Wait with exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after multiple attempts');
};

/**
 * Provider component for messages functionality
 */
export const MessagesProvider: React.FC<MessagesProviderProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  
  // Firebase Functions initialization
  const [functionsInitialized, setFunctionsInitialized] = useState(false);
  const functionsRef = useRef<Functions | null>(null);
  
  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ 
    totalUnread: 0, 
    unreadByChat: {} 
  });
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  
  // Loading states
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Refs to prevent infinite loops
  const isProcessingReadUpdate = useRef(false);
  const recentlyReadMessageIds = useRef<Set<string>>(new Set());
  const lastSelectedChatRef = useRef<string | null>(null);
  const messageUpdateHandlerRef = useRef<(messages: OptimisticMessage[]) => void>(() => {});
  const mountedRef = useRef(true);
  const processUnreadMessagesRef = useRef<(messages: OptimisticMessage[], uid: string) => void>(
    (messages, uid) => {}
  );
  const optimisticMessagesRef = useRef<Map<string, OptimisticMessage>>(new Map());
  
  // Fixed: Reset loading state on component mount to prevent stale loading states
  useEffect(() => {
    // Reset loading states on mount to prevent getting stuck in loading state
    setIsLoadingChats(false);
    setIsLoadingMessages(false);
    
    // Set mounted flag and clear on unmount
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Initialize Firebase Functions
  useEffect(() => {
    try {
      // Only initialize functions once
      if (!functionsRef.current) {
        console.log("Initializing Firebase Functions");
        functionsRef.current = getFunctions();
        setFunctionsInitialized(true);
      }
    } catch (error) {
      console.error("Failed to initialize Firebase Functions:", error);
      setError("Failed to initialize messaging system. Please try again later.");
    }
  }, []);
  
  // Clear error helper
  const clearError = () => setError(null);
  
  // Process unread messages - using ref to prevent dependency cycles
  useEffect(() => {
    // Update the ref function
    processUnreadMessagesRef.current = (messages: Message[], uid: string) => {
      if (!selectedChatId || isProcessingReadUpdate.current) return;
      
      const unreadMessageIds = messages
        .filter(msg => 
          // Only process messages not sent by current user
          msg.senderId !== uid && 
          // Only process if not read
          (!msg.readBy || !msg.readBy[uid]) &&
          // Skip if we recently processed this message
          !recentlyReadMessageIds.current.has(msg.id)
        )
        .map(msg => msg.id);
      
      if (unreadMessageIds.length === 0) return;
      
      // Set processing flag
      isProcessingReadUpdate.current = true;
      
      // Add to recently processed set
      unreadMessageIds.forEach(id => recentlyReadMessageIds.current.add(id));
      
      // Mark as read with a slight delay
      setTimeout(() => {
        // First, call the service to update server state
        messagingService.markMessagesAsRead(selectedChatId, unreadMessageIds)
          .then(() => {
            // After success, update local unread counts state
            setUnreadCounts(prev => {
              const unreadByChat = { ...prev.unreadByChat };
              
              // Reset count for the current chat
              unreadByChat[selectedChatId] = 0;
              
              // Recalculate total
              const totalUnread = Object.values(unreadByChat).reduce((sum, count) => sum + count, 0);
              
              return { totalUnread, unreadByChat };
            });
            
            // Also update message read status in local state
            setMessages(prevMessages => prevMessages.map(msg => {
              if (unreadMessageIds.includes(msg.id)) {
                return {
                  ...msg,
                  readBy: { ...(msg.readBy || {}), [uid]: true }
                };
              }
              return msg;
            }));
          })
          .catch(err => console.error('Error marking messages as read:', err))
          .finally(() => {
            // Clear processing flag after a cooldown period
            setTimeout(() => {
              isProcessingReadUpdate.current = false;
              
              // Clean up recently read message ids older than 30 seconds
              setTimeout(() => {
                if (mountedRef.current) {
                  unreadMessageIds.forEach(id => recentlyReadMessageIds.current.delete(id));
                }
              }, 30000);
            }, 500);
          });
      }, 300);
    };
  }, [selectedChatId]);
  
  // Load chats with retry and better error handling
  useEffect(() => {
    // Fixed: Use a stable reference for checking mount status
    // to address the component unmounting during async operations
    let isMounted = true;
    
    if (!user || !functionsInitialized) {
      setChats([]);
      return;
    }
    
    const loadChats = async () => {
      // Enhanced debugging logs
      console.log("Starting to load chats - Initial state check");
      console.log("User authenticated:", !!user);
      console.log("User ID:", user?.uid);
      console.log("Functions initialized:", functionsInitialized);
      
      // Fixed: Only set loading state if we don't already have cached chats
      if (chats.length === 0) {
        setIsLoadingChats(true);
      } else {
        console.log("Using existing chats while refreshing in background");
      }
      
      setError(null);
      
      try {
        console.log("About to call messagingService.getUserChats()");
        
        // Add a timeout for better error handling
        let loadedChats: Chat[] = [];
        
        const loadPromise = retryOperation(
          () => {
            console.log("Executing getUserChats() with retry logic");
            return messagingService.getUserChats();
          },
          3, // 3 retries
          1000 // 1 second delay between retries
        ).then(result => {
          console.log("getUserChats() succeeded with result:", result);
          loadedChats = result;
        });
        
        // Race against a timeout - but use a shorter timeout (5 sec instead of 15)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.log("Request timed out after 5 seconds");
            reject(new Error("Request timed out"));
          }, 5000);
        });
        
        await Promise.race([loadPromise, timeoutPromise]);
        
        // Fixed: Only update state if component is still mounted
        if (isMounted) {
          console.log(`Loaded ${loadedChats.length} chats, now updating state`);
          console.log("Sample chat data:", loadedChats.length > 0 ? loadedChats[0] : "No chats");
          setChats(loadedChats);
        } else {
          console.log("Component unmounted during chat loading, skipping state update");
        }
      } catch (err) {
        console.error('Detailed error loading chats:', err);
        
        // Log more details about the error
        if (err instanceof Error) {
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
          console.error('Error stack:', err.stack);
          
          // Check for Firebase error
          if (err.name === 'FirebaseError') {
            console.error('Firebase error code:', (err as any).code);
            console.error('Firebase error details:', (err as any).details);
          }
        }
        
        if (isMounted) {
          // More detailed error message
          const errorMessage = err instanceof Error ? 
            `Failed to load conversations: ${err.message}` : 
            'Failed to load conversations';
          console.log("Setting error state:", errorMessage);
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          console.log("Finishing chat loading process, setting isLoadingChats to false");
          setIsLoadingChats(false);
        } else {
          console.log("Component unmounted during chat loading, skipping state update");
        }
      }
    };
    
    loadChats();
    
    // Fixed: Return cleanup function that updates the mount status
    return () => {
      isMounted = false;
    };
  }, [user, functionsInitialized, chats.length]);
  
  // Load unread counts with better error handling
  useEffect(() => {
    // Fixed: Use a separate mount check for this effect
    let isMounted = true;
    
    if (!user || !functionsInitialized) {
      setUnreadCounts({ totalUnread: 0, unreadByChat: {} });
      return;
    }
    
    const loadUnreadCounts = async () => {
      try {
        // Add a failsafe default in case of error
        let counts = { totalUnread: 0, unreadByChat: {} };
        
        try {
          // Use a shorter timeout for this operation
          const countPromise = messagingService.getTotalUnreadCounts();
          const timeoutPromise = new Promise<UnreadCounts>((_, reject) => {
            setTimeout(() => reject(new Error("Unread counts timeout")), 3000);
          });
          
          // Race against a short timeout
          counts = await Promise.race([countPromise, timeoutPromise])
            .catch(error => {
              console.warn("Unread counts timed out, using defaults:", error);
              return { totalUnread: 0, unreadByChat: {} };
            });
        } catch (countError) {
          console.error('Error loading unread counts:', countError);
          // Continue with default empty counts
        }
        
        if (isMounted) {
          setUnreadCounts(counts);
        }
      } catch (err) {
        console.error('Error in unread counts process:', err);
        // Don't set error state here to avoid interrupting the main flow
      }
    };
    
    loadUnreadCounts();
    
    // Set up an interval to refresh counts
    const interval = setInterval(loadUnreadCounts, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(interval);
      isMounted = false;
    };
  }, [user, functionsInitialized]);
  
  // Handle chat selection with message loading and subscription
  useEffect(() => {
    let messageUnsubscribe: (() => void) | null = null;
    let isMounted = true;
    
    // Set up the message update handler with a stable reference
    messageUpdateHandlerRef.current = (updatedMessages: OptimisticMessage[]) => {
      if (!isMounted) return;
      
      // Safe handling of messages with timestamp conversion
      if (Array.isArray(updatedMessages)) {
        // Convert any timestamp-like objects to proper Timestamp objects
        const messagesWithSafeTimestamps = updatedMessages.map(msg => ({
          ...msg,
          createdAt: safeToFirestoreTimestamp(msg.createdAt)
        }));
        
        // Merge with any optimistic messages that haven't been confirmed yet
        const combinedMessages = [...messagesWithSafeTimestamps];
        
        // Replace optimistic messages with real ones if they've arrived
        optimisticMessagesRef.current.forEach((optimisticMsg, tempId) => {
          // Check if we have a real message with this content and timestamp close to our optimistic one
          const matchingRealMsg = messagesWithSafeTimestamps.find(msg => 
            msg.senderId === optimisticMsg.senderId && 
            msg.content === optimisticMsg.content &&
            Math.abs((msg.createdAt as Timestamp).toMillis() - 
                   (optimisticMsg.createdAt as Timestamp).toMillis()) < 10000
          );
          
          if (matchingRealMsg) {
            // Found a match, remove this optimistic message
            optimisticMessagesRef.current.delete(tempId);
            console.log('Replaced optimistic message with real message:', matchingRealMsg.id);
          } else {
            // No match found, keep the optimistic message
            combinedMessages.push(optimisticMsg);
          }
        });
        
        // Sort all messages by timestamp
        combinedMessages.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return aTime - bTime;
        });
        
        setMessages(combinedMessages);
        
        // Process unread messages if user is available
        if (user) {
          processUnreadMessagesRef.current(messagesWithSafeTimestamps, user.uid);
        }
      } else {
        console.error('Invalid messages update format:', updatedMessages);
      }
    };
    
    const loadSelectedChat = async () => {
      // Clear previous state if no chat is selected
      if (!selectedChatId) {
        setSelectedChat(null);
        setMessages([]);
        setCurrentPage(0);
        setTotalMessageCount(0);
        setHasMoreMessages(false);
        return;
      }
      
      if (!user || !functionsInitialized) return;
      
      setIsLoadingMessages(true);
      setError(null);
      
      try {
        console.log(`Loading chat ${selectedChatId}`);
        
        // First, try to get the chat from cache or local state
        const localChat = chats.find(c => c.id === selectedChatId);
        
        if (localChat) {
          // If we have the chat locally, use it immediately to reduce loading time
          setSelectedChat(localChat);
          setTotalMessageCount(localChat.messageCount || 0);
        }
        
        // Then load the chat details with retry (even if we have it locally to ensure freshness)
        try {
          const chat = await retryOperation(
            () => messagingService.getChatById(selectedChatId),
            3
          );
          
          if (isMounted) {
            setSelectedChat(chat);
            setTotalMessageCount(chat.messageCount || 0);
            
            try {
              // Then load the messages with retry
              const messagesBatch = await retryOperation(
                () => messagingService.getChatMessages(selectedChatId, PAGINATION.MESSAGES),
                3
              );
              
              // Safely handle possible undefined values
              if (messagesBatch && Array.isArray(messagesBatch.messages)) {
                // Convert any timestamp-like objects to proper Timestamp objects
                const messagesWithSafeTimestamps = messagesBatch.messages.map(msg => ({
                  ...msg,
                  createdAt: safeToFirestoreTimestamp(msg.createdAt)
                }));
                
                setMessages(messagesWithSafeTimestamps);
                setHasMoreMessages(messagesWithSafeTimestamps.length < (messagesBatch.totalCount || 0));
                setCurrentPage(1);
              } else {
                // Handle case where messagesBatch or messages is undefined
                setMessages([]);
                setHasMoreMessages(false);
                setCurrentPage(0);
                console.error('Invalid message batch format:', messagesBatch);
              }
              
              // Subscribe to message updates - clean up any previous subscription
              if (messageUnsubscribe) {
                messageUnsubscribe();
              }
              
              console.log(`Setting up message subscription for chat ${selectedChatId}`);
              messageUnsubscribe = messagingService.subscribeToMessages({
                chatId: selectedChatId,
                userId: user.uid,
                onMessagesUpdate: messageUpdateHandlerRef.current,
                onError: (error) => {
                  console.error('Message subscription error:', error);
                  
                  if (isMounted) {
                    setError('Error receiving messages. Please refresh.');
                  }
                }
              });
            } catch (messagesError) {
              console.error('Error loading messages:', messagesError);
              setError('Failed to load messages. Please try again.');
            }
          }
        } catch (chatError) {
          console.error('Error loading chat:', chatError);
          
          if (isMounted) {
            // Set a more specific error message based on the error type
            if ((chatError as Error).name === 'NotFoundError') {
              setError('This conversation could not be found. It may have been deleted.');
            } else if ((chatError as Error).name === 'PermissionError') {
              setError('You do not have permission to view this conversation.');
            } else {
              setError('Failed to load the conversation. Please try again later.');
            }
            
            // Still try to load messages if we have the chat locally
            if (localChat) {
              try {
                // Attempt to load messages anyway if we at least have the local chat data
                // This gives a better UX than showing an error right away
                const messagesBatch = await retryOperation(
                  () => messagingService.getChatMessages(selectedChatId, PAGINATION.MESSAGES),
                  3
                );
                
                if (messagesBatch && Array.isArray(messagesBatch.messages)) {
                  setMessages(messagesBatch.messages.map(msg => ({
                    ...msg,
                    createdAt: safeToFirestoreTimestamp(msg.createdAt)
                  })));
                  setHasMoreMessages(messagesBatch.messages.length < (messagesBatch.totalCount || 0));
                  setCurrentPage(1);
                }
              } catch (messagesError) {
                console.error('Error loading messages:', messagesError);
                // At this point, both chat and messages failed to load
                // Keep the error from the chat loading failure
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in loadSelectedChat flow:', err);
        
        if (isMounted) {
          setError('Failed to load conversation. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    };
    
    loadSelectedChat();
    
    // Cleanup
    return () => {
      if (messageUnsubscribe) {
        messageUnsubscribe();
      }
      isMounted = false;
    };
  }, [selectedChatId, user, functionsInitialized, chats]);
  
  // Select a chat with protection against redundant updates
  const selectChat = useCallback(async (chatId: string | null): Promise<void> => {
    // Only change selection if it's actually different
    if (chatId !== lastSelectedChatRef.current) {
      console.log(`Selecting chat: ${chatId}`);
      lastSelectedChatRef.current = chatId;
      setSelectedChatId(chatId);
    }
  }, []);
  
  // IMPORTANT: Define refreshChats before sendMessage since it's used in sendMessage's dependency array
  // Refresh chats with retry
  const refreshChats = useCallback(async (): Promise<void> => {
    if (!user || !functionsInitialized) return;
    
    setIsLoadingChats(true);
    setError(null);
    
    try {
      // Invalidate cache first
      messagingService.invalidateUserChatsCache();
      
      // Load fresh data with retry
      const loadedChats = await retryOperation(
        () => messagingService.getUserChats(),
        2
      );
      
      setChats(loadedChats);
      
      // Also refresh unread counts
      const counts = await retryOperation(
        () => messagingService.getTotalUnreadCounts(),
        2
      );
      
      setUnreadCounts(counts);
    } catch (err) {
      console.error('Error refreshing chats:', err);
      const errorMessage = err instanceof Error ? 
        `Failed to refresh conversations: ${err.message}` : 
        'Failed to refresh conversations';
      setError(errorMessage);
    } finally {
      setIsLoadingChats(false);
    }
  }, [user, functionsInitialized]);
  
  // Enhanced sendMessage with better error handling and message recovery
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!selectedChatId || !content.trim() || !user || !functionsInitialized) {
      if (!selectedChatId) {
        setError("No conversation selected");
      } else if (!content.trim()) {
        setError("Message cannot be empty");
      } else if (!user) {
        setError("You must be logged in to send messages");
      }
      return false;
    }
    
    setIsSendingMessage(true);
    setError(null);
    
    // Save the message content for potential recovery
    const messageBackup = content.trim();
    const chatBackup = selectedChatId;
    let optimisticId = '';
    
    try {
      // Add a delay to allow Firebase to properly update remote state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create an optimistic message for immediate UI feedback
      optimisticId = `temp-${Date.now()}`;
      const optimisticMessage: OptimisticMessage = {
        id: optimisticId,
        chatId: selectedChatId,
        senderId: user.uid,
        content: content.trim(),
        createdAt: Timestamp.now(),
        readBy: { [user.uid]: true },
        // Flag to indicate this is optimistic (will be removed when real message arrives)
        isOptimistic: true
      };
      
      // Store the optimistic message in our ref and update UI
      optimisticMessagesRef.current.set(optimisticId, optimisticMessage);
      
      // Add the optimistic message to the UI immediately
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      
      // Try to send with retry logic
      await retryOperation(
        async () => {
          const result = await messagingService.sendMessage(selectedChatId, content);
          
          // If successful, replace the optimistic message with the real one
          if (result) {
            // Remove the optimistic message from our ref
            optimisticMessagesRef.current.delete(optimisticId);
            
            // Update messages to replace optimistic with real
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                // Replace our temp message with the real one
                (msg.id === optimisticId ? { ...result, isOptimistic: false } : msg)
              )
            );
          }
          return result;
        },
        3, // 3 retries
        500  // 500ms initial delay, will increase exponentially
      );
      
      // Also update the chat list to show the message immediately
      await refreshChats().catch(err => {
        console.warn('Error refreshing chats after message sent:', err);
      });
      
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove the optimistic message on failure
      optimisticMessagesRef.current.delete(optimisticId);
      setMessages(prevMessages => 
        prevMessages.filter(msg => !msg.isOptimistic)
      );
      
      // Create a more user-friendly error message based on the error type
      let errorMessage = 'Failed to send message';
      
      if (err instanceof Error) {
        // Parse specific error types
        if (err.message.includes('not-found')) {
          errorMessage = 'This conversation no longer exists';
        } else if (err.message.includes('permission-denied')) {
          errorMessage = 'You do not have permission to send messages in this conversation';
        } else if (err.message.includes('unavailable') || err.message.includes('resource-exhausted')) {
          errorMessage = 'Service is temporarily unavailable. Please try again';
        } else if (err.message.includes('timeout') || err.message.includes('deadline-exceeded')) {
          errorMessage = 'Request timed out. Please check your connection and try again';
        } else if (err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again';
        } else {
          // Include the original error for debugging but make it user-friendly
          errorMessage = `Failed to send message: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Show toast for better visibility
      showToast({
        title: "Message not sent",
        description: errorMessage,
        variant: "error",
        duration: 5000,
        action: (
          <button 
            className="ml-2 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            onClick={() => sendMessage(messageBackup)}
          >
            Retry
          </button>
        )
      });
      
      // Store the failed message attempt for potential recovery
      try {
        const storedMessages = JSON.parse(localStorage.getItem('bunkr_failed_messages') || '[]');
        storedMessages.push({
          chatId: chatBackup,
          content: messageBackup,
          timestamp: Date.now()
        });
        localStorage.setItem('bunkr_failed_messages', JSON.stringify(storedMessages));
      } catch (storageError) {
        console.warn('Could not store failed message for recovery:', storageError);
      }
      
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedChatId, user, functionsInitialized, refreshChats]);
  
  // Retry failed messages implementation
  const retryFailedMessages = useCallback(async (): Promise<void> => {
    try {
      const storedMessages = JSON.parse(localStorage.getItem('bunkr_failed_messages') || '[]');
      
      if (storedMessages.length === 0) return;
      
      // Remove messages older than 24 hours
      const validMessages = storedMessages.filter(
        (msg: any) => Date.now() - msg.timestamp < 24 * 60 * 60 * 1000
      );
      
      if (validMessages.length === 0) {
        localStorage.removeItem('bunkr_failed_messages');
        return;
      }
      
      // Process valid messages
      const successfulMessageIndices: number[] = [];
      
      for (let i = 0; i < validMessages.length; i++) {
        const msg = validMessages[i];
        
        try {
          if (msg.chatId === selectedChatId) {
            // Only retry if we're in the same chat
            const success = await sendMessage(msg.content);
            
            if (success) {
              successfulMessageIndices.push(i);
            }
          }
        } catch (error) {
          console.warn('Error retrying failed message:', error);
        }
        
        // Wait a bit between retries
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Remove successful messages from storage
      const remainingMessages = validMessages.filter(
        (_: any, index: number) => !successfulMessageIndices.includes(index)
      );
      
      if (remainingMessages.length === 0) {
        localStorage.removeItem('bunkr_failed_messages');
      } else {
        localStorage.setItem('bunkr_failed_messages', JSON.stringify(remainingMessages));
      }
    } catch (error) {
      console.error('Error retrying failed messages:', error);
    }
  }, [selectedChatId, sendMessage]);
  
  // Network status detection
  useEffect(() => {
    // Only set up listener in browser environment
    if (typeof window === 'undefined') return;
    
    // Track online status changes
    const handleOnline = () => {
      console.log('Network connection restored');
      // When we come back online, retry fetching data and failed messages
      if (user && functionsInitialized) {
        refreshChats()
          .then(() => {
            // After refreshing chats, try to retry any failed messages
            retryFailedMessages();
          })
          .catch(err => {
            console.warn('Error refreshing data after coming online:', err);
          });
      }
    };
    
    const handleOffline = () => {
      console.log('Network connection lost');
      // Show toast notification when offline
      showToast({
        title: "You are offline",
        description: "Messages will be sent when you reconnect",
        variant: "warning",
        duration: 5000
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Also check connectivity status when mounting
    if (navigator.onLine && user && functionsInitialized) {
      retryFailedMessages();
      
      // Also try to retry any pending messages in the service
      messagingService.retryPendingMessages().catch(err => {
        console.warn('Error retrying pending messages from service:', err);
      });
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, functionsInitialized, refreshChats, retryFailedMessages]);
  
  // Mark messages as read with retry
  const markMessagesAsRead = useCallback(async (messageIds: string[]): Promise<boolean> => {
    if (!selectedChatId || !user || !functionsInitialized || messageIds.length === 0) {
      return false;
    }
    
    try {
      await retryOperation(
        () => messagingService.markMessagesAsRead(selectedChatId, messageIds),
        2
      );
      
      // Update local state
      setMessages(prevMessages => prevMessages.map(msg => {
        if (messageIds.includes(msg.id)) {
          return {
            ...msg,
            readBy: { ...(msg.readBy || {}), [user.uid]: true }
          };
        }
        return msg;
      }));
      
      // Update unread counts
      setUnreadCounts(prev => {
        const unreadByChat = { ...prev.unreadByChat };
        
        // Reset count for the current chat
        unreadByChat[selectedChatId] = 0;
        
        // Recalculate total
        const totalUnread = Object.values(unreadByChat).reduce((sum, count) => sum + count, 0);
        
        return { totalUnread, unreadByChat };
      });
      
      return true;
    } catch (err) {
      console.error('Error marking messages as read:', err);
      // Don't show error to user for this operation
      return false;
    }
  }, [selectedChatId, user, functionsInitialized]);
  
  // Delete a message with retry
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!selectedChatId || !user || !functionsInitialized) {
      return false;
    }
    
    setError(null);
    
    try {
      await retryOperation(
        () => messagingService.deleteMessage(selectedChatId, messageId),
        2
      );
      
      // Update local state immediately with deleted state
      setMessages(prevMessages => prevMessages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            deleted: true,
            content: 'This message has been deleted'
          };
        }
        return msg;
      }));
      
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      const errorMessage = err instanceof Error ? 
        `Failed to delete message: ${err.message}` : 
        'Failed to delete message';
      setError(errorMessage);
      return false;
    }
  }, [selectedChatId, user, functionsInitialized]);
  
  // Load more messages (pagination) with retry - Instagram style approach
  const loadMoreMessages = useCallback(async (): Promise<boolean> => {
    if (!selectedChatId || !user || !functionsInitialized || !hasMoreMessages) {
      return false;
    }
    
    setIsLoadingMessages(true);
    
    try {
      // Get the oldest message we have as a starting point
      let startAfterMessageId: string | undefined;
      
      if (messages.length > 0) {
        // Find the oldest message (first in the array since they're sorted chronologically)
        const oldestMessage = messages[0];
        startAfterMessageId = oldestMessage.id;
      }
      
      // Use the messaging service to get older messages
      const messagesBatch = await retryOperation(
        () => messagingService.getChatMessages(
          selectedChatId, 
          PAGINATION.MESSAGES, 
          startAfterMessageId
        ),
        2
      );
      
      // Prepend the new messages to the existing ones
      setMessages(prevMessages => {
        if (messagesBatch && Array.isArray(messagesBatch.messages)) {
          // Ensure no duplicates and convert timestamps
          const existingIds = new Set(prevMessages.map(msg => msg.id));
          const newMessages = messagesBatch.messages
            .filter(msg => !existingIds.has(msg.id))
            .map(msg => ({
              ...msg,
              createdAt: safeToFirestoreTimestamp(msg.createdAt)
            }));
          
          return [...newMessages, ...prevMessages];
        }
        return prevMessages;
      });
      
      setCurrentPage(prevPage => prevPage + 1);
      
      // Update hasMoreMessages flag based on the response
      if (messagesBatch && typeof messagesBatch.totalCount === 'number') {
        const messagesLoaded = PAGINATION.MESSAGES * (currentPage + 1);
        setHasMoreMessages(messagesLoaded < messagesBatch.totalCount);
      } else {
        // Fallback to checking if we received a full page of messages
        setHasMoreMessages(
          messagesBatch && 
          Array.isArray(messagesBatch.messages) && 
          messagesBatch.messages.length >= PAGINATION.MESSAGES
        );
      }
      
      return true;
    } catch (err) {
      console.error('Error loading more messages:', err);
      const errorMessage = err instanceof Error ? 
        `Failed to load more messages: ${err.message}` : 
        'Failed to load more messages';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedChatId, user, functionsInitialized, messages, currentPage, hasMoreMessages]);
  
  // Search users with retry
  const searchUsers = useCallback(async (query: string): Promise<SimplifiedUserProfile[]> => {
    if (!user || !functionsInitialized || !query.trim()) {
      return [];
    }
    
    setIsSearchingUsers(true);
    
    try {
      return await retryOperation(
        () => messagingService.searchUsers(query),
        2
      );
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      return [];
    } finally {
      setIsSearchingUsers(false);
    }
  }, [user, functionsInitialized]);
  
  // Start a chat with a user with retry
  const startChatWithUser = useCallback(async (userId: string): Promise<string | null> => {
    if (!user || !functionsInitialized) {
      return null;
    }
    
    setError(null);
    
    try {
      const chat = await retryOperation(
        () => messagingService.getOrCreateChat(userId),
        2
      );
      
      // Refresh chats
      refreshChats().catch(err => console.error('Error refreshing chats:', err));
      
      return chat.id;
    } catch (err) {
      console.error('Error starting chat:', err);
      const errorMessage = err instanceof Error ? 
        `Failed to start conversation: ${err.message}` : 
        'Failed to start conversation';
      setError(errorMessage);
      return null;
    }
  }, [user, functionsInitialized, refreshChats]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      messagingService.cleanupAllSubscriptions();
    };
  }, []);
  
  // Context value
  const value: MessagesContextType = {
    chats,
    selectedChatId,
    selectedChat,
    messages,
    unreadCounts,
    hasMoreMessages,
    
    isLoadingChats,
    isLoadingMessages,
    isSendingMessage,
    isSearchingUsers,
    
    error,
    
    selectChat,
    sendMessage,
    markMessagesAsRead,
    deleteMessage,
    loadMoreMessages,
    refreshChats,
    searchUsers,
    startChatWithUser,
    clearError,
    setError,
    retryFailedMessages
  };
  
  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};

/**
 * Hook for accessing messages context
 */
export const useMessages = () => useContext(MessagesContext);
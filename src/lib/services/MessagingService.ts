/**
 * MessagingService.ts
 * Core service for handling all messaging operations with Firebase
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  serverTimestamp,
  QueryDocumentSnapshot,
  Unsubscribe,
  writeBatch,
  arrayRemove,
  arrayUnion,
  DocumentReference,
  setDoc,
  runTransaction
} from 'firebase/firestore';
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { db, auth } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';
import { 
  Chat, 
  Message, 
  SimplifiedUserProfile, 
  MessageBatch,
  UnreadCounts,
  MessageSubscriptionParams
} from '@/types/messages';
import { MessageCollectionService } from '@/lib/services/MessageCollectionService';
import { cacheService } from './CacheService';
import {
  SHARD_SIZE,
  MAX_SHARDS,
  CACHE_KEYS,
  CACHE_TTL,
  DELETED_MESSAGE_TEXT,
  generateSubscriptionId
} from '../constants';
import { safeTimestampToDate, safeToFirestoreTimestamp } from '@/lib/utils/timestamp-utils';

// Error classes for better error handling
export class AuthenticationError extends Error {
  constructor(message = 'You must be logged in to perform this action') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'The requested resource was not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Service for handling messaging operations
 */
export class MessagingService {
  private static instance: MessagingService;
  private messageCollectionService: MessageCollectionService;
  private activeSubscriptions: Map<string, Unsubscribe> = new Map();
  
  private constructor() {
    this.messageCollectionService = MessageCollectionService.getInstance();
  }
  
  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }
  
  /**
   * Checks if the user is authenticated
   * @throws AuthenticationError if not authenticated
   */
  private checkAuthentication(): string {
    if (!auth.currentUser) {
      throw new AuthenticationError();
    }
    return auth.currentUser.uid;
  }
  
  /**
   * Gets all chats for the current user with efficient batching and caching
   */
  public async getUserChats(): Promise<Chat[]> {
    const userId = this.checkAuthentication();
    const cacheKey = CACHE_KEYS.USER_CHATS(userId);
    
    try {
      // Try to get from cache first
      const cachedChats = await cacheService.get<Chat[]>(cacheKey);
      if (cachedChats) {
        console.log('Using cached chats data');
        return cachedChats;
      }
      
      // Query for chats with the current user
      const chatsQuery = query(
        collection(db, 'messages'),
        where('participantArray', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );
      
      const chatsSnapshot = await getDocs(chatsQuery);
      
      if (chatsSnapshot.empty) {
        return [];
      }
      
      // Process chats in batches for better performance
      const chats: Chat[] = [];
      const participantIds = new Set<string>();
      
      // First, extract all participant IDs for batch loading
      chatsSnapshot.docs.forEach(doc => {
        const chatData = doc.data();
        const otherParticipants = chatData.participantArray.filter(
          (id: string) => id !== userId
        );
        otherParticipants.forEach((id: string) => participantIds.add(id));
      });
      
      // Batch load participant profiles
      const participantProfiles = await this.batchLoadUserProfiles(Array.from(participantIds));
      
      // Now process each chat with the preloaded profiles
      chatsSnapshot.docs.forEach(doc => {
        const chatData = doc.data();
        
        // Extract participant profiles for this chat
        const chatParticipantProfiles: Record<string, SimplifiedUserProfile> = {};
        const otherParticipants = chatData.participantArray.filter(
          (id: string) => id !== userId
        );
        
        otherParticipants.forEach((participantId: string) => {
          if (participantProfiles[participantId]) {
            chatParticipantProfiles[participantId] = participantProfiles[participantId];
          }
        });
        
        // Create the chat object with type safety
        const chat: Chat = {
          id: doc.id,
          participants: chatData.participants || {},
          participantArray: chatData.participantArray || [],
          createdAt: this.convertTimestamp(chatData.createdAt),
          updatedAt: this.convertTimestamp(chatData.updatedAt),
          lastMessage: chatData.lastMessage ? {
            content: chatData.lastMessage.content,
            senderId: chatData.lastMessage.senderId,
            createdAt: this.convertTimestamp(chatData.lastMessage.createdAt)
          } : undefined,
          isGroupChat: chatData.isGroupChat || false,
          title: chatData.title,
          messageCount: chatData.messageCount || 0,
          participantProfiles: chatParticipantProfiles,
          unreadCounters: chatData.unreadCounters || {}
        };
        
        chats.push(chat);
      });
      
      // Cache the result with standard TTL
      await cacheService.set(cacheKey, chats, { ttl: CACHE_TTL.USER_CHATS });
      
      return chats;
    } catch (error) {
      console.error('Error fetching chats:', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error('Failed to load conversations');
    }
  }
  
  /**
   * Get a chat by ID with proper validation and error handling
   */
  public async getChatById(chatId: string): Promise<Chat> {
    const userId = this.checkAuthentication();
    const cacheKey = CACHE_KEYS.CHAT(chatId);
    
    try {
      // Try cache first
      const cachedChat = await cacheService.get<Chat>(cacheKey);
      if (cachedChat) {
        return cachedChat;
      }
      
      // Fetch from Firestore
      const chatDocRef = doc(db, 'messages', chatId);
      const chatDoc = await getDoc(chatDocRef);
      
      if (!chatDoc.exists()) {
        throw new NotFoundError('Chat not found');
      }
      
      const chatData = chatDoc.data();
      
      // Verify the user is a participant
      if (!chatData.participantArray?.includes(userId) && 
          !chatData.participants?.[userId]) {
        throw new PermissionError('You are not a participant in this conversation');
      }
      
      // Get participant profiles
      const otherParticipants = chatData.participantArray.filter(
        (id: string) => id !== userId
      );
      const participantProfiles = await this.batchLoadUserProfiles(otherParticipants);
      
      // Create the chat object
      const chat: Chat = {
        id: chatDoc.id,
        participants: chatData.participants || {},
        participantArray: chatData.participantArray || [],
        createdAt: this.convertTimestamp(chatData.createdAt),
        updatedAt: this.convertTimestamp(chatData.updatedAt),
        lastMessage: chatData.lastMessage ? {
          content: chatData.lastMessage.content,
          senderId: chatData.lastMessage.senderId,
          createdAt: this.convertTimestamp(chatData.lastMessage.createdAt)
        } : undefined,
        isGroupChat: chatData.isGroupChat || false,
        title: chatData.title,
        messageCount: chatData.messageCount || 0,
        participantProfiles: participantProfiles,
        unreadCounters: chatData.unreadCounters || {}
      };
      
      // Cache the result with standard TTL
      await cacheService.set(cacheKey, chat, { ttl: CACHE_TTL.CHAT });
      
      return chat;
    } catch (error) {
      console.error('Error fetching chat:', error);
      
      // Re-throw specific errors so they can be handled properly
      if (error instanceof AuthenticationError || 
          error instanceof PermissionError || 
          error instanceof NotFoundError) {
        throw error;
      }
      
      // For other errors, add more context to the error message
      const errorMessage = error instanceof Error ? 
        `Failed to load conversation: ${error.message}` : 
        'Failed to load conversation';
      
      console.error(`Detailed error context: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get or create a chat with another user
   */
  public async getOrCreateChat(otherUserId: string): Promise<Chat> {
    const userId = this.checkAuthentication();
    
    if (otherUserId === userId) {
      throw new Error('You cannot message yourself');
    }
    
    try {
      // Call Cloud Function for creating the chat
      const functions = getFunctions();
      const getOrCreateChatFn = httpsCallable(functions, 'getOrCreateChat');
      const result = await getOrCreateChatFn({ otherUserId });
      
      // Parse and validate the response
      const chatData = result.data as any;
      
      if (!chatData || !chatData.id) {
        throw new Error('Failed to create conversation');
      }
      
      // Cache the result
      const chat: Chat = {
        id: chatData.id,
        participants: chatData.participants || {},
        participantArray: chatData.participantArray || [],
        createdAt: this.convertTimestamp(chatData.createdAt),
        updatedAt: this.convertTimestamp(chatData.updatedAt),
        lastMessage: chatData.lastMessage ? {
          content: chatData.lastMessage.content,
          senderId: chatData.lastMessage.senderId,
          createdAt: this.convertTimestamp(chatData.lastMessage.createdAt)
        } : undefined,
        isGroupChat: chatData.isGroupChat || false,
        title: chatData.title,
        messageCount: chatData.messageCount || 0,
        participantProfiles: chatData.participantProfiles || {},
        unreadCounters: chatData.unreadCounters || {}
      };
      
      await cacheService.set(CACHE_KEYS.CHAT(chat.id), chat, { ttl: CACHE_TTL.CHAT });
      
      // Update the user chats cache
      this.invalidateUserChatsCache();
      
      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error('Failed to start conversation');
    }
  }
  
  /**
   * Get messages for a specific chat with Instagram-style approach
   * Always loads most recent messages first and supports pagination
   */
  public async getChatMessages(chatId: string, pageSize: number = 30, startAfterMessageId?: string): Promise<MessageBatch> {
    const userId = this.checkAuthentication();
    const cacheKey = CACHE_KEYS.MESSAGES(chatId, pageSize);
    
    try {
      // Try to get from cache first if not fetching with pagination after a message
      if (!startAfterMessageId) {
        const cachedMessages = await cacheService.get<MessageBatch>(cacheKey);
        if (cachedMessages) {
          console.log('Using cached messages data');
          return cachedMessages;
        }
      }
      
      // Verify the chat exists and user is a participant
      const chat = await this.getChatById(chatId);
      
      // Try to use the cloud function for better performance
      try {
        const functions = getFunctions();
        const getChatMessagesFn = httpsCallable(functions, 'getChatMessages');
        const result = await getChatMessagesFn({
          chatId,
          pageSize,
          startAfterMessageId
        });
        
        const response = result.data as any;
        
        // Convert the messages to our type with null safety for timestamps
        const messages: Message[] = (response.messages || []).map((msg: any) => ({
          id: msg.id,
          chatId,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: this.convertTimestamp(msg.createdAt),
          readBy: msg.readBy || {},
          deleted: msg.deleted || false
        }));
        
        const messageBatch: MessageBatch = {
          messages,
          totalCount: response.totalCount || 0,
          lastProcessedIndex: response.lastProcessedIndex || 0
        };
        
        // Cache the results only for initial queries, not pagination
        if (!startAfterMessageId) {
          await cacheService.set(cacheKey, messageBatch, { ttl: CACHE_TTL.MESSAGES });
        }
        
        return messageBatch;
      } catch (cloudFnError) {
        console.warn('Cloud function error, falling back to client-side loading:', cloudFnError);
        
        // Fallback: Load messages client-side with Instagram-style approach
        const messageBatch = await this.getMessagesFallback(chatId, pageSize, startAfterMessageId);
        
        // Cache the results only for initial queries, not pagination
        if (!startAfterMessageId) {
          await cacheService.set(cacheKey, messageBatch, { ttl: CACHE_TTL.MESSAGES });
        }
        
        return messageBatch;
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (error instanceof AuthenticationError || 
          error instanceof PermissionError || 
          error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to load messages');
    }
  }
  
  /**
   * Fallback method for loading messages client-side with Instagram-style approach
   */
  private async getMessagesFallback(chatId: string, pageSize: number = 30, startAfterMessageId?: string): Promise<MessageBatch> {
    try {
      const userId = this.checkAuthentication();
      
      // Get the total message count for the chat
      const messageCount = await this.messageCollectionService.getMessageCount(chatId);
      
      let messages: Message[] = [];
      
      if (startAfterMessageId) {
        // This is a pagination request - find the message and load older ones
        const { message: startMessage, shardId } = await this.messageCollectionService.findMessageAcrossShards(chatId, startAfterMessageId);
        
        if (startMessage && startMessage.createdAt) {
          // Get messages before this one in the same shard
          const { collectionName } = await this.messageCollectionService.getMessageDocRef(chatId, startAfterMessageId);
          
          const olderMessagesQuery = query(
            collection(db, 'messages', chatId, collectionName),
            where('createdAt', '<', startMessage.createdAt),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
          );
          
          const olderMessagesSnapshot = await getDocs(olderMessagesQuery);
          
          // Process messages in this shard
          olderMessagesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              chatId,
              senderId: data.senderId,
              content: data.content,
              createdAt: this.convertTimestamp(data.createdAt),
              readBy: data.readBy || {},
              deleted: data.deleted || false
            });
          });
          
          // If we need more and there are earlier shards, query them too
          if (messages.length < pageSize && shardId > 0) {
            // Get all collections in order
            const collections = await this.messageCollectionService.getAllMessageCollectionRefs(chatId);
            
            // Process earlier shards for remaining messages
            for (let i = shardId - 1; i >= 0 && messages.length < pageSize; i--) {
              const earlierShard = collections[i];
              const remainingNeeded = pageSize - messages.length;
              
              const earlierQuery = query(
                earlierShard.collectionRef,
                orderBy('createdAt', 'desc'),
                limit(remainingNeeded)
              );
              
              const earlierSnapshot = await getDocs(earlierQuery);
              
              earlierSnapshot.docs.forEach(doc => {
                const data = doc.data();
                messages.push({
                  id: doc.id,
                  chatId,
                  senderId: data.senderId,
                  content: data.content,
                  createdAt: this.convertTimestamp(data.createdAt),
                  readBy: data.readBy || {},
                  deleted: data.deleted || false
                });
              });
            }
          }
        }
      } else {
        // This is an initial load - get the most recent messages
        const collections = await this.messageCollectionService.getAllMessageCollectionRefs(chatId);
        
        // Start with the most recent shard
        for (let i = collections.length - 1; i >= 0 && messages.length < pageSize; i--) {
          const remainingNeeded = pageSize - messages.length;
          
          const recentQuery = query(
            collections[i].collectionRef,
            orderBy('createdAt', 'desc'),
            limit(remainingNeeded)
          );
          
          const recentSnapshot = await getDocs(recentQuery);
          
          recentSnapshot.docs.forEach(doc => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              chatId,
              senderId: data.senderId,
              content: data.content,
              createdAt: this.convertTimestamp(data.createdAt),
              readBy: data.readBy || {},
              deleted: data.deleted || false
            });
          });
        }
      }
      
      // Sort by timestamp - oldest first for consistent UI rendering
      messages.sort((a, b) => {
        try {
          // Handle Timestamp objects (use toMillis) since getTime doesn't exist on Timestamp
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return aTime - bTime;
        } catch (error) {
          console.error('Error sorting messages by timestamp:', error);
          return 0;
        }
      });
      
      // Determine if there are more messages available
      const hasMore = messages.length < messageCount;
      
      return {
        messages,
        totalCount: messageCount,
        lastProcessedIndex: hasMore ? messages.length : messageCount
      };
    } catch (error) {
      console.error('Error in fallback message loading:', error);
      throw new Error('Failed to load messages');
    }
  }
  
  /**
   * Subscribe to messages for a chat with proper cleanup
   */
  public subscribeToMessages({ chatId, userId, onMessagesUpdate, onError }: MessageSubscriptionParams): () => void {
    // Generate a unique subscription ID
    const subscriptionId = generateSubscriptionId(chatId, userId);
    
    // Clean up any existing subscription for this chat
    this.unsubscribeFromChat(subscriptionId);
    
    try {
      // Set up the subscription
      const setupSubscription = async () => {
        try {
          // Get the latest collection based on message count
          const { collectionRef } = await this.messageCollectionService.getLatestMessageShard(chatId);
          
          // Set up the listener
          const messagesQuery = query(
            collectionRef,
            orderBy('createdAt', 'asc')
          );
          
          const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
            try {
              // Process the messages with safe timestamp handling
              const messages: Message[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  chatId,
                  senderId: data.senderId,
                  content: data.content,
                  createdAt: this.convertTimestamp(data.createdAt),
                  readBy: data.readBy || {},
                  deleted: data.deleted || false
                };
              });
              
              // Sort by timestamp
              messages.sort((a, b) => {
                try {
                  // Handle Timestamp objects (use toMillis) since getTime doesn't exist on Timestamp
                  const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                  const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                  return aTime - bTime;
                } catch (error) {
                  console.error('Error sorting messages by timestamp:', error);
                  return 0;
                }
              });
              
              // Call the callback with the messages
              onMessagesUpdate(messages);
              
              // Cache the messages
              cacheService.set(CACHE_KEYS.MESSAGES(chatId, 30), {
                messages,
                totalCount: messages.length,
                lastProcessedIndex: messages.length
              }, { ttl: CACHE_TTL.MESSAGES });
            } catch (processError) {
              console.error('Error processing snapshot:', processError);
              onError?.(processError instanceof Error ? processError : new Error(String(processError)));
            }
          }, (error) => {
            console.error('Error in message subscription:', error);
            onError?.(error);
          });
          
          // Store the unsubscribe function
          this.activeSubscriptions.set(subscriptionId, unsubscribe);
        } catch (setupError) {
          console.error('Error setting up message subscription:', setupError);
          onError?.(setupError instanceof Error ? setupError : new Error(String(setupError)));
        }
      };
      
      // Start the subscription process
      setupSubscription();
      
      // Return a cleanup function
      return () => {
        this.unsubscribeFromChat(subscriptionId);
      };
    } catch (error) {
      console.error('Error in subscription setup:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      
      // Return a no-op cleanup function
      return () => {};
    }
  }
  
  /**
   * Enhanced sendMessage with better error handling and recovery
   */
  public async sendMessage(chatId: string, content: string): Promise<Message> {
    const userId = this.checkAuthentication();
    
    if (!content.trim()) {
      throw new Error('Message cannot be empty');
    }
    
    // Create a unique message ID to track this send attempt
    const clientMessageId = `${chatId}_${userId}_${Date.now()}`;
    
    try {
      // Store pending message in local storage for recovery
      this.storePendingMessage(clientMessageId, chatId, content);
      
      // Call the cloud function to send the message with exponential backoff
      const functions = getFunctions();
      const sendMessageFn = httpsCallable(functions, 'sendMessage');
      
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      
      while (attempts < maxAttempts) {
        try {
          const result = await sendMessageFn({ 
            chatId, 
            content,
            clientMessageId // Include for deduplication
          });
          
          const response = result.data as any;
          
          if (!response.success) {
            throw new Error(response.message || 'Failed to send message');
          }
          
          // Create a message object to return
          const message: Message = {
            id: response.messageId,
            chatId,
            senderId: userId,
            content: content.trim(),
            createdAt: Timestamp.now(),
            readBy: { [userId]: true }
          };
          
          // Remove from pending messages since it succeeded
          this.removePendingMessage(clientMessageId);
          
          // Update caches
          await this.updateChatAfterMessageSent(chatId, message);
          
          return message;
        } catch (err) {
          lastError = err;
          attempts++;
          
          // Check if retryable error
          if (this.isRetryableError(err)) {
            // Exponential backoff
            const delayMs = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          } else {
            // Non-retryable error, break the loop
            break;
          }
        }
      }
      
      // If we got here, all attempts failed
      if (lastError) {
        // Keep the pending message for potential future recovery
        if (this.isRetryableError(lastError)) {
          console.warn('Message send failed but saved for retry', { clientMessageId, chatId });
        } else {
          // For non-retryable errors, remove the pending message
          this.removePendingMessage(clientMessageId);
        }
        
        throw lastError;
      }
      
      throw new Error('Failed to send message after multiple attempts');
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Provide more specific error message based on the error type
      if (error.code === 'permission-denied') {
        throw new PermissionError('You do not have permission to send messages in this chat');
      } else if (error.code === 'not-found') {
        throw new NotFoundError('Chat not found');
      } else if (error.code === 'resource-exhausted') {
        throw new Error('Service is temporarily unavailable. Please try again later.');
      } else if (error.code === 'deadline-exceeded') {
        throw new Error('Request timed out. Please check your connection and try again.');
      } else if (error.code === 'unavailable') {
        throw new Error('Service is currently unavailable. Please try again later.');
      }
      
      throw new Error('Failed to send message: ' + (error.message || 'Unknown error'));
    }
  }
  
  /**
   * Determine if an error should be retried
   */
  private isRetryableError(error: any): boolean {
    // NetworkError, timeout, or server errors (500+) should be retried
    if (!error) return false;
    
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted',
      'internal',
      'cancelled'
    ];
    
    return (
      error.code && retryableCodes.includes(error.code) ||
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      (error.httpErrorCode && error.httpErrorCode >= 500)
    );
  }
  
  /**
   * Store a pending message in local storage for potential recovery
   */
  private storePendingMessage(id: string, chatId: string, content: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const pendingMessages = this.getPendingMessages();
      pendingMessages[id] = {
        chatId,
        content,
        timestamp: Date.now(),
        attempts: 0
      };
      
      localStorage.setItem('bunkr_pending_messages', JSON.stringify(pendingMessages));
    } catch (e) {
      console.warn('Failed to store pending message', e);
    }
  }
  
  /**
   * Remove a pending message from local storage
   */
  private removePendingMessage(id: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const pendingMessages = this.getPendingMessages();
      if (pendingMessages[id]) {
        delete pendingMessages[id];
        localStorage.setItem('bunkr_pending_messages', JSON.stringify(pendingMessages));
      }
    } catch (e) {
      console.warn('Failed to remove pending message', e);
    }
  }
  
  /**
   * Get all pending messages from local storage
   */
  private getPendingMessages(): Record<string, any> {
    if (typeof window === 'undefined') return {};
    
    try {
      const data = localStorage.getItem('bunkr_pending_messages');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Failed to get pending messages', e);
      return {};
    }
  }
  
  /**
   * Attempt to retry sending all pending messages
   * Call this method when the app starts or when connectivity is restored
   */
  public async retryPendingMessages(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      // Check if we're authenticated
      if (!auth.currentUser) return;
      
      const pendingMessages = this.getPendingMessages();
      const pendingIds = Object.keys(pendingMessages);
      
      if (pendingIds.length === 0) return;
      
      console.log(`Attempting to retry ${pendingIds.length} pending messages`);
      
      // Process in series to avoid overwhelming the server
      for (const id of pendingIds) {
        const message = pendingMessages[id];
        
        // Skip messages older than 24 hours
        if (Date.now() - message.timestamp > 24 * 60 * 60 * 1000) {
          this.removePendingMessage(id);
          continue;
        }
        
        // Skip messages that have been attempted too many times
        if (message.attempts >= 5) {
          this.removePendingMessage(id);
          continue;
        }
        
        try {
          // Increment attempt counter
          message.attempts++;
          localStorage.setItem('bunkr_pending_messages', JSON.stringify(pendingMessages));
          
          // Try to send the message
          await this.sendMessage(message.chatId, message.content);
          
          // If successful, the message will be removed in sendMessage
        } catch (error) {
          console.warn(`Failed to retry message ${id}:`, error);
          
          // Non-retryable errors should remove the message
          if (!this.isRetryableError(error)) {
            this.removePendingMessage(id);
          }
        }
        
        // Wait a bit between retries
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.error('Error retrying pending messages:', e);
    }
  }
  
  /**
   * Unsubscribe from a specific chat subscription
   */
  private unsubscribeFromChat(subscriptionId: string): void {
    const unsubscribe = this.activeSubscriptions.get(subscriptionId);
    
    if (unsubscribe) {
      unsubscribe();
      this.activeSubscriptions.delete(subscriptionId);
    }
  }
  
  /**
   * Clean up all active subscriptions
   */
  public cleanupAllSubscriptions(): void {
    this.activeSubscriptions.forEach((unsubscribe, key) => {
      unsubscribe();
    });
    
    this.activeSubscriptions.clear();
  }
  
  /**
   * Mark messages as read with optimized approach to prevent infinite loops
   */
  public async markMessagesAsRead(chatId: string, messageIds: string[]): Promise<void> {
    const userId = this.checkAuthentication();
    
    if (messageIds.length === 0) {
      return;
    }
    
    try {
      // Use a transaction to update both the chat document and message read status
      // to ensure atomicity and prevent multiple updates triggering multiple events
      return await runTransaction(db, async (transaction) => {
        // 1. Update the chat's unread counter first
        const chatRef = doc(db, 'messages', chatId);
        transaction.update(chatRef, {
          [`unreadCounters.${userId}`]: 0
        });
        
        // 2. Determine which shards contain these messages
        const messageShards = new Map<string, string[]>(); // Map<collectionName, messageIds[]>
        
        // Group messages by shard with a maximum of 100 lookups to prevent excessive operations
        const messagesToProcess = messageIds.slice(0, 100);
        
        for (const messageId of messagesToProcess) {
          try {
            const { collectionName } = await this.messageCollectionService.getMessageDocRef(chatId, messageId);
            
            if (!messageShards.has(collectionName)) {
              messageShards.set(collectionName, []);
            }
            
            messageShards.get(collectionName)?.push(messageId);
          } catch (error) {
            console.warn(`Could not find shard for message ${messageId}:`, error);
          }
        }
        
        // 3. Update each message's read status within the transaction
        for (const [collectionName, ids] of messageShards.entries()) {
          for (const messageId of ids) {
            const messageRef = doc(db, 'messages', chatId, collectionName, messageId);
            transaction.update(messageRef, {
              [`readBy.${userId}`]: true
            });
          }
        }
        
        // 4. Update local caches after transaction completes
        // This is done outside the transaction since it's client-side only
        this.updateUnreadCountsCache(chatId, 0).catch(err => {
          console.warn('Error updating unread counts cache:', err);
        });
        
        // Also update the message cache
        this.updateMessageReadStatusInCache(chatId, messageIds, userId).catch(err => {
          console.warn('Error updating message cache:', err);
        });
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }
  
  /**
   * Helper method to update message read status in cache
   */
  private async updateMessageReadStatusInCache(
    chatId: string, 
    messageIds: string[], 
    userId: string
  ): Promise<void> {
    if (messageIds.length === 0) return;
    
    try {
      // Update all cached message batches for this chat
      const messagesCacheKey = CACHE_KEYS.MESSAGES(chatId, 30);
      const cachedMessageBatch = await cacheService.get<MessageBatch>(messagesCacheKey);
      
      if (cachedMessageBatch) {
        // Create a Set for faster lookups
        const messageIdSet = new Set(messageIds);
        
        const updatedMessages = cachedMessageBatch.messages.map(msg => {
          if (messageIdSet.has(msg.id)) {
            return {
              ...msg,
              readBy: { ...(msg.readBy || {}), [userId]: true }
            };
          }
          return msg;
        });
        
        await cacheService.set(messagesCacheKey, {
          ...cachedMessageBatch,
          messages: updatedMessages
        }, { ttl: CACHE_TTL.MESSAGES });
      }
      
      // Update chat cache
      const chatCacheKey = CACHE_KEYS.CHAT(chatId);
      const cachedChat = await cacheService.get<Chat>(chatCacheKey);
      
      if (cachedChat) {
        const updatedChat = {
          ...cachedChat,
          unreadCounters: {
            ...(cachedChat.unreadCounters || {}),
            [userId]: 0
          }
        };
        
        await cacheService.set(chatCacheKey, updatedChat, { ttl: CACHE_TTL.CHAT });
      }
    } catch (error) {
      console.error('Error updating message read status in cache:', error);
    }
  }
  
  /**
   * Delete a message (soft delete)
   */
  public async deleteMessage(chatId: string, messageId: string): Promise<void> {
    const userId = this.checkAuthentication();
    
    try {
      // Get the message reference
      const { docRef } = await this.messageCollectionService.getMessageDocRef(chatId, messageId);
      
      // Get the message to verify ownership
      const messageDoc = await getDoc(docRef);
      
      if (!messageDoc.exists()) {
        throw new NotFoundError('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Verify ownership
      if (messageData.senderId !== userId) {
        throw new PermissionError('You can only delete your own messages');
      }
      
      // Perform soft delete
      await updateDoc(docRef, {
        deleted: true,
        content: DELETED_MESSAGE_TEXT
      });
      
      // Update message cache
      const messagesCacheKey = CACHE_KEYS.MESSAGES(chatId, 30);
      const cachedMessageBatch = await cacheService.get<MessageBatch>(messagesCacheKey);
      
      if (cachedMessageBatch) {
        const updatedMessages = cachedMessageBatch.messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              deleted: true,
              content: DELETED_MESSAGE_TEXT
            };
          }
          return msg;
        });
        
        await cacheService.set(messagesCacheKey, {
          ...cachedMessageBatch,
          messages: updatedMessages
        }, { ttl: CACHE_TTL.MESSAGES });
      }
      
      // Also update chat lastMessage if this was the last message
      const chatCacheKey = CACHE_KEYS.CHAT(chatId);
      const cachedChat = await cacheService.get<Chat>(chatCacheKey);
      
      if (cachedChat?.lastMessage?.senderId === userId) {
        const chatRef = doc(db, 'messages', chatId);
        const chatDoc = await getDoc(chatRef);
        
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          
          // If this message was the last message, update the preview
          if (chatData.lastMessage && 
              chatData.lastMessage.senderId === userId &&
              chatData.lastMessage.messageId === messageId) {
            
            await updateDoc(chatRef, {
              'lastMessage.content': DELETED_MESSAGE_TEXT
            });
            
            // Update the cache too
            if (cachedChat) {
              await cacheService.set(chatCacheKey, {
                ...cachedChat,
                lastMessage: {
                  ...cachedChat.lastMessage,
                  content: DELETED_MESSAGE_TEXT
                }
              }, { ttl: CACHE_TTL.CHAT });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      if (error instanceof AuthenticationError || 
          error instanceof PermissionError || 
          error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to delete message');
    }
  }
  
  /**
   * Search for users to message
   */
  public async searchUsers(query: string, limit: number = 10): Promise<SimplifiedUserProfile[]> {
    this.checkAuthentication();
    
    if (!query.trim()) {
      return [];
    }
    
    try {
      // Use the cloud function for searching
      const functions = getFunctions();
      const searchUsersFn = httpsCallable(functions, 'searchUsers');
      const result = await searchUsersFn({ query: query.trim(), limit });
      
      const response = result.data as any;
      
      if (!response.users) {
        return [];
      }
      
      // Convert to our type and cache the profiles
      const users: SimplifiedUserProfile[] = response.users.map((user: any) => ({
        uid: user.uid,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        handicapIndex: user.handicapIndex || null
      }));
      
      // Cache individual user profiles
      for (const user of users) {
        await cacheService.set(CACHE_KEYS.USER_PROFILE(user.uid), user, { ttl: CACHE_TTL.USER_PROFILE });
      }
      
      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search users');
    }
  }
  
  /**
   * Get total unread counts
   */
  public async getTotalUnreadCounts(): Promise<UnreadCounts> {
    const userId = this.checkAuthentication();
    const cacheKey = CACHE_KEYS.UNREAD_COUNTS(userId);
    
    try {
      // Try cache first
      const cachedCounts = await cacheService.get<UnreadCounts>(cacheKey);
      if (cachedCounts) {
        return cachedCounts;
      }
      
      // Call the cloud function
      const functions = getFunctions();
      const getUnreadCountFn = httpsCallable(functions, 'getTotalUnreadCount');
      const result = await getUnreadCountFn();
      
      const response = result.data as UnreadCounts;
      
      // Cache the result with standardized TTL
      await cacheService.set(cacheKey, response, { ttl: CACHE_TTL.UNREAD_COUNTS });
      
      return response;
    } catch (error) {
      console.error('Error getting unread counts:', error);
      return { totalUnread: 0, unreadByChat: {} };
    }
  }
  
  /**
   * Batch load user profiles
   */
  private async batchLoadUserProfiles(userIds: string[]): Promise<Record<string, SimplifiedUserProfile>> {
    if (userIds.length === 0) {
      return {};
    }
    
    const profiles: Record<string, SimplifiedUserProfile> = {};
    const uncachedUserIds: string[] = [];
    
    // First, try to get profiles from cache
    for (const userId of userIds) {
      const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
      const cachedProfile = await cacheService.get<SimplifiedUserProfile>(cacheKey);
      
      if (cachedProfile) {
        profiles[userId] = cachedProfile;
      } else {
        uncachedUserIds.push(userId);
      }
    }
    
    // If all profiles were in cache, return early
    if (uncachedUserIds.length === 0) {
      return profiles;
    }
    
    try {
      // Batch load the uncached profiles
      // Process in chunks of 10 for Firestore performance
      const chunkSize = 10;
      for (let i = 0; i < uncachedUserIds.length; i += chunkSize) {
        const chunk = uncachedUserIds.slice(i, i + chunkSize);
        
        // Use a single query with 'in' operator
        const usersQuery = query(
          collection(db, 'users'),
          where('uid', 'in', chunk)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        
        // Process the results
        usersSnapshot.forEach(doc => {
          const userData = doc.data() as UserProfile;
          
          const profile: SimplifiedUserProfile = {
            uid: doc.id,
            displayName: userData.displayName || null,
            photoURL: userData.photoURL || null,
            handicapIndex: userData.handicapIndex || null
          };
          
          profiles[doc.id] = profile;
          
          // Cache the profile with standardized TTL
          const cacheKey = CACHE_KEYS.USER_PROFILE(doc.id);
          cacheService.set(cacheKey, profile, { ttl: CACHE_TTL.USER_PROFILE });
        });
      }
      
      // For any users that weren't found, create placeholders
      uncachedUserIds.forEach(userId => {
        if (!profiles[userId]) {
          const placeholderProfile: SimplifiedUserProfile = {
            uid: userId,
            displayName: 'User',
            photoURL: null,
            handicapIndex: null
          };
          
          profiles[userId] = placeholderProfile;
          
          // Cache the placeholder with a shorter TTL (1 minute)
          const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
          cacheService.set(cacheKey, placeholderProfile, { ttl: 60 * 1000 });
        }
      });
      
      return profiles;
    } catch (error) {
      console.error('Error batch loading user profiles:', error);
      
      // Create placeholders for any unfetched profiles
      uncachedUserIds.forEach(userId => {
        if (!profiles[userId]) {
          profiles[userId] = {
            uid: userId,
            displayName: 'User',
            photoURL: null,
            handicapIndex: null
          };
        }
      });
      
      return profiles;
    }
  }
  
  /**
   * Get user profile by ID with caching
   */
  public async getUserProfile(userId: string): Promise<SimplifiedUserProfile | null> {
    const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
    
    try {
      // Try cache first
      const cachedProfile = await cacheService.get<SimplifiedUserProfile>(cacheKey);
      if (cachedProfile) {
        return cachedProfile;
      }
      
      // Fetch from Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const userData = userDoc.data() as UserProfile;
      
      const profile: SimplifiedUserProfile = {
        uid: userId,
        displayName: userData.displayName || null,
        photoURL: userData.photoURL || null,
        handicapIndex: userData.handicapIndex || null
      };
      
      // Cache the profile with standardized TTL
      await cacheService.set(cacheKey, profile, { ttl: CACHE_TTL.USER_PROFILE });
      
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }
  
  /**
   * Update caches after sending a message
   */
  private async updateChatAfterMessageSent(chatId: string, message: Message): Promise<void> {
    const userId = this.checkAuthentication();
    
    try {
      // Update the chat cache
      const chatCacheKey = CACHE_KEYS.CHAT(chatId);
      const cachedChat = await cacheService.get<Chat>(chatCacheKey);
      
      if (cachedChat) {
        const updatedChat = {
          ...cachedChat,
          lastMessage: {
            content: message.content,
            senderId: message.senderId,
            createdAt: message.createdAt,
            messageId: message.id // Store this for deletion checking
          },
          updatedAt: message.createdAt,
          messageCount: cachedChat.messageCount + 1,
          unreadCounters: {
            ...(cachedChat.unreadCounters || {}),
            [userId]: 0  // Reset sender's unread counter
          }
        };
        
        await cacheService.set(chatCacheKey, updatedChat, { ttl: CACHE_TTL.CHAT });
      }
      
      // Update the messages cache for all page sizes
      const messagesKeys = await cacheService.getAllKeys();
      const messageCacheKeys = messagesKeys.filter((key: string) => key.startsWith(`messages_${chatId}`));
      
      for (const key of messageCacheKeys) {
        const cachedMessageBatch = await cacheService.get<MessageBatch>(key);
        if (cachedMessageBatch) {
          const updatedMessages = [...cachedMessageBatch.messages, message];
          const updatedBatch = {
            ...cachedMessageBatch,
            messages: updatedMessages,
            totalCount: cachedMessageBatch.totalCount + 1
          };
          await cacheService.set(key, updatedBatch, { ttl: CACHE_TTL.MESSAGES });
        }
      }
      
      // Update unread counts cache
      await this.updateUnreadCountsCache(chatId, 0);
      
      // Invalidate the message count cache
      this.messageCollectionService.invalidateMessageCountCache(chatId);
      
      // Also invalidate user chats cache to reflect the new message
      await cacheService.invalidateUserCache(userId);
    } catch (error) {
      console.error('Error updating caches after sending message:', error);
    }
  }
  
  /**
   * Update unread counts cache for a specific chat
   */
  private async updateUnreadCountsCache(chatId: string, count: number): Promise<void> {
    const userId = this.checkAuthentication();
    const cacheKey = CACHE_KEYS.UNREAD_COUNTS(userId);
    
    try {
      const cachedCounts = await cacheService.get<UnreadCounts>(cacheKey);
      
      if (cachedCounts) {
        const updatedCounts = {
          ...cachedCounts,
          unreadByChat: {
            ...cachedCounts.unreadByChat,
            [chatId]: count
          }
        };
        
        // Recalculate total
        updatedCounts.totalUnread = Object.values(updatedCounts.unreadByChat).reduce(
          (sum, c) => sum + c, 0
        );
        
        await cacheService.set(cacheKey, updatedCounts, { ttl: CACHE_TTL.UNREAD_COUNTS });
      }
    } catch (error) {
      console.error('Error updating unread counts cache:', error);
    }
  }
  
  /**
   * Invalidate user chats cache
   */
  public invalidateUserChatsCache(): void {
    if (!auth.currentUser) return;
    
    const userId = auth.currentUser.uid;
    cacheService.remove(CACHE_KEYS.USER_CHATS(userId));
  }
  
  /**
   * Convert any timestamp-like value to a Firestore Timestamp
   * This is a robust utility that handles various timestamp formats
   */
  private convertTimestamp(timestamp: any): Timestamp {
    return safeToFirestoreTimestamp(timestamp);
  }
}
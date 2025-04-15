// src/messaging.function.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { SHARD_SIZE, MAX_SHARDS } from '../lib/constants';

// Define the interface directly to avoid import issues
interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  coverPhotoURL?: string | null;
  createdAt: admin.firestore.Timestamp | Date;
  handicapIndex: number | null;
  homeCourse: string | null;
  profileComplete: boolean;
  bio?: string | null;
  displayNameLower?: string | null;
}

// Define Message interface to ensure type safety
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: admin.firestore.Timestamp;
  readBy: Record<string, boolean>;
  deleted?: boolean;
}

// Initialize the app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Type definitions to fix TypeScript errors
interface ChatDocument {
  participants: Record<string, boolean>;
  participantArray: string[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  unreadCounters?: Record<string, number>;
  messageCount?: number;
  isGroupChat?: boolean;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: admin.firestore.Timestamp;
    messageId?: string;
  };
}

// Simple profile info interface for chat participants
interface ChatParticipantProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  handicapIndex: number | null;
}

/**
 * Helper for message collection sharding
 * Determines which collection to use based on message count
 */
function getMessageCollectionName(messageCount: number): string {
  if (messageCount < 0) {
    logger.warn(`Invalid message count: ${messageCount}, defaulting to 'thread'`);
    return 'thread';
  }
  
  const shardId = Math.floor(messageCount / SHARD_SIZE);
  // Enforce max shard limit to match security rules
  const limitedShardId = Math.min(shardId, MAX_SHARDS - 1);
  return limitedShardId > 0 ? `thread_${limitedShardId}` : 'thread';
}

// Send a message with optimized side effects and improved error handling
export const sendMessage = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    failurePolicy: true, // Enable automatic retries on failure
  })
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to send messages'
      );
    }

    const { chatId, content, clientMessageId } = data;
    const userId = context.auth.uid;
    
    // Enhanced input validation
    if (!chatId || typeof chatId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID is required and must be a string'
      );
    }
    
    // Improved content validation with proper trimming
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Message cannot be empty'
      );
    }

    try {
      logger.info(`User ${userId} sending message to chat ${chatId} (client ID: ${clientMessageId || 'none'})`);
      
      // Verify chat exists before transaction to fail fast
      const chatRef = db.collection('messages').doc(chatId);
      const chatDoc = await chatRef.get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Chat not found'
        );
      }
      
      const chatData = chatDoc.data() as ChatDocument | undefined;
      
      // Verify chat data exists
      if (!chatData) {
        throw new functions.https.HttpsError(
          'internal',
          'Invalid chat data structure'
        );
      }
      
      // Verify user is participant
      const isParticipant = (
        (chatData.participants && chatData.participants[userId] === true) ||
        (chatData.participantArray && chatData.participantArray.includes(userId))
      );
      
      if (!isParticipant) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not a participant in this conversation'
        );
      }
      
      // Break the operation into smaller transactions
      // 1. First calculate the message collection and create message
      const messageCount = chatData.messageCount || 0;
      const collectionName = getMessageCollectionName(messageCount);
      
      logger.info(`Using collection ${collectionName} for chat ${chatId} with message count ${messageCount}`);
      
      // Create message document reference
      const messageRef = db.collection('messages')
        .doc(chatId)
        .collection(collectionName)
        .doc();
      
      // Create message data with defensive defaults
      const messageData = {
        senderId: userId,
        content: trimmedContent.substring(0, 2000), // Limit content length
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readBy: {[userId]: true}, // Current user has read the message
        clientMessageId: clientMessageId || null // Store this for deduplication
      };
      
      // Execute first transaction - just create the message
      await db.runTransaction(async transaction => {
        // If client message ID is provided, check for duplicates
        if (clientMessageId) {
          // Query for messages with this client ID (simple deduplication)
          const recentMessagesQuery = db.collection('messages')
            .doc(chatId)
            .collection(collectionName)
            .where('clientMessageId', '==', clientMessageId)
            .limit(1);
            
          const duplicateCheck = await transaction.get(recentMessagesQuery);
          
          if (!duplicateCheck.empty) {
            logger.info(`Detected duplicate message with client ID: ${clientMessageId}`);
            // Return existing message ID rather than creating a new one
            return duplicateCheck.docs[0].id;
          }
        }
        
        transaction.set(messageRef, messageData);
        return messageRef.id;
      });
      
      // 2. Second transaction - update the chat metadata
      await db.runTransaction(async transaction => {
        // Re-get the chat data to ensure we have the latest
        const freshChatDoc = await transaction.get(chatRef);
        if (!freshChatDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            'Chat not found during metadata update'
          );
        }
        
        const freshChatData = freshChatDoc.data() as ChatDocument;
        
        // Update chat metadata with all necessary information
        const updateData: Record<string, any> = {
          lastMessage: {
            content: trimmedContent.substring(0, 100) + (trimmedContent.length > 100 ? '...' : ''),
            senderId: userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            messageId: messageRef.id // Store this for later reference
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          messageCount: admin.firestore.FieldValue.increment(1)
        };
        
        // Defensively create unreadCounters object if missing
        if (!freshChatData.unreadCounters || typeof freshChatData.unreadCounters !== 'object') {
          updateData.unreadCounters = {};
          
          // Ensure participantArray exists
          const participants = Array.isArray(freshChatData.participantArray) 
            ? freshChatData.participantArray 
            : Object.keys(freshChatData.participants || {});
          
          // Initialize all counters
          participants.forEach(participantId => {
            updateData.unreadCounters[participantId] = participantId === userId ? 0 : 1;
          });
        } else {
          // Increment unread counters for all other participants
          // Use participantArray first, fallback to participants object
          const participants = Array.isArray(freshChatData.participantArray) 
            ? freshChatData.participantArray 
            : Object.keys(freshChatData.participants || {});
          
          participants.forEach(participantId => {
            if (participantId !== userId) {
              updateData[`unreadCounters.${participantId}`] = admin.firestore.FieldValue.increment(1);
            }
          });
          
          // CRITICAL FIX: Explicitly set sender's unread counter to 0
          // This ensures the sender always sees their messages as read
          updateData[`unreadCounters.${userId}`] = 0;
        }
        
        transaction.update(chatRef, updateData);
        return true;
      });
      
      return { 
        success: true, 
        messageId: messageRef.id,
        chatId: chatId,
        timestamp: Date.now() // Include timestamp for client verification
      };
    } catch (error: unknown) {
      // Enhanced error logging and categorization
      logger.error(`Error sending message to chat ${chatId}:`, error);
      
      // Determine error type for better client handling
      let errorCode = 'internal';
      let errorMessage = 'Failed to send message';
      
      if (error instanceof functions.https.HttpsError) {
        // Pass through existing HttpsErrors
        throw error;
      } else if (
        typeof error === 'object' && 
        error !== null && 
        'name' in error && 
        'code' in error
      ) {
        // Type assertion after verification
        const firebaseError = error as { name: string; code: string };
        
        if (firebaseError.name === 'FirebaseError') {
          switch (firebaseError.code) {
            case 'permission-denied':
              errorCode = 'permission-denied';
              errorMessage = 'Permission denied: You cannot send messages to this chat';
              break;
            case 'not-found':
              errorCode = 'not-found';
              errorMessage = 'Chat no longer exists';
              break;
            case 'resource-exhausted':
              errorCode = 'resource-exhausted';
              errorMessage = 'Service temporarily unavailable. Please try again later.';
              break;
            case 'deadline-exceeded':
              errorCode = 'deadline-exceeded';
              errorMessage = 'Operation timed out. Please try again.';
              break;
          }
        }
      }
      
      throw new functions.https.HttpsError(
        errorCode as any,
        errorMessage,
        error instanceof Error ? { originalError: error.message } : undefined
      );
    }
  });

// Mark chat as read with optimized operations
export const markChatAsRead = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId } = data;
    const userId = context.auth.uid;
    
    if (!chatId || typeof chatId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID is required'
      );
    }
    
    try {
      // Verify user is participant
      const chatRef = db.collection('messages').doc(chatId);
      const chatDoc = await chatRef.get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Chat not found'
        );
      }
      
      const chatData = chatDoc.data() as ChatDocument;
      
      // Check if user is a participant
      if (!chatData.participants?.[userId] && !chatData.participantArray?.includes(userId)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not a participant in this conversation'
        );
      }
      
      // Reset unread counter in single write operation
      const updateData: Record<string, any> = {
        [`unreadCounters.${userId}`]: 0
      };
      
      await chatRef.update(updateData);
      
      // Also mark all messages as read using parallel batch operations
      // Calculate which collection(s) to update
      const messageCount = chatData.messageCount || 0;
      const totalShards = Math.min(Math.floor(messageCount / SHARD_SIZE) + 1, MAX_SHARDS);
      
      // Array of promises for batch operations - process shards in parallel
      const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];
      
      // Process each shard with a separate batch, in parallel
      const processShard = async (shardId: number): Promise<FirebaseFirestore.WriteResult[]> => {
        const collectionName = getMessageCollectionName(shardId * SHARD_SIZE);
        
        // Query for unread messages in this shard
        const unreadMessagesQuery = db.collection('messages')
          .doc(chatId)
          .collection(collectionName)
          .where(`readBy.${userId}`, '==', false)
          .limit(500); // Firestore limits batch operations
        
        const unreadSnapshot = await unreadMessagesQuery.get();
        
        if (unreadSnapshot.empty) {
          return [];
        }
        
        const batch = db.batch();
        
        unreadSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            [`readBy.${userId}`]: true
          });
        });
        
        return batch.commit();
      };
      
      // Process all shards in parallel
      for (let shardId = 0; shardId < totalShards; shardId++) {
        batchPromises.push(processShard(shardId));
      }
      
      // Execute all batch operations in parallel
      if (batchPromises.length > 0) {
        await Promise.all(batchPromises);
      }
      
      return { 
        success: true,
        chatId: chatId
      };
    } catch (error) {
      logger.error(`Error marking chat ${chatId} as read:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to mark chat as read',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Get chat messages with Instagram-style approach (load most recent first)
export const getChatMessages = functions
  .runWith({
    timeoutSeconds: 120, // Increased from 30 to 120
    memory: '1GB',      // Increased from 256MB to 1GB
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId, pageSize = 30, startAfterMessageId } = data;
    const userId = context.auth.uid;
    
    if (!chatId || typeof chatId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID is required'
      );
    }
    
    try {
      // Verify user is participant
      const chatRef = db.collection('messages').doc(chatId);
      const chatDoc = await chatRef.get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Chat not found'
        );
      }
      
      const chatData = chatDoc.data() as ChatDocument;
      
      // Check if user is a participant
      if (!chatData.participants?.[userId] && !chatData.participantArray?.includes(userId)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not a participant in this conversation'
        );
      }
      
      // Get total message count
      const messageCount = chatData.messageCount || 0;
      
      // If there are no messages, return empty array
      if (messageCount === 0) {
        return { 
          messages: [], 
          totalCount: 0,
          lastProcessedIndex: 0
        };
      }
      
      // Calculate which shards to query
      const totalShards = Math.min(Math.floor(messageCount / SHARD_SIZE) + 1, MAX_SHARDS);
      const messages: Message[] = [];
      let lastProcessedIndex = 0;
      
      if (startAfterMessageId) {
        // PAGINATION MODE: Load messages before a specific message
        // Find the message in the appropriate shard and load older messages
        
        // Find which collection contains the message
        const latestShardId = Math.min(Math.floor((messageCount - 1) / SHARD_SIZE), MAX_SHARDS - 1);
        let messageFound = false;
        let foundShardId = -1;
        let foundMessageTimestamp = null;

        // Try the latest shard first
        const latestCollectionName = getMessageCollectionName(latestShardId * SHARD_SIZE);
        const latestMessageRef = db.collection('messages')
          .doc(chatId)
          .collection(latestCollectionName)
          .doc(startAfterMessageId);
        
        const latestMessageDoc = await latestMessageRef.get();
        
        if (latestMessageDoc.exists) {
          messageFound = true;
          foundShardId = latestShardId;
          foundMessageTimestamp = latestMessageDoc.data()?.createdAt;
        } 
        
        // If not found in latest shard, check other shards
        if (!messageFound && totalShards > 1) {
          // Simplified, check each shard from newest to oldest
          for (let shardId = latestShardId - 1; shardId >= 0 && !messageFound; shardId--) {
            const collectionName = getMessageCollectionName(shardId * SHARD_SIZE);
            const messageRef = db.collection('messages')
              .doc(chatId)
              .collection(collectionName)
              .doc(startAfterMessageId);
            
            const messageDoc = await messageRef.get();
            
            if (messageDoc.exists) {
              messageFound = true;
              foundShardId = shardId;
              foundMessageTimestamp = messageDoc.data()?.createdAt;
            }
          }
        }
        
        // If we found the message, query from that point
        if (messageFound && foundMessageTimestamp) {
          // Get messages in the same shard that are older
          const collectionName = getMessageCollectionName(foundShardId * SHARD_SIZE);
          const olderMessagesQuery = db.collection('messages')
            .doc(chatId)
            .collection(collectionName)
            .orderBy('createdAt', 'desc')
            .where('createdAt', '<', foundMessageTimestamp)
            .limit(pageSize);
          
          const olderMessagesSnapshot = await olderMessagesQuery.get();
          
          // Add messages to the result
          olderMessagesSnapshot.docs.forEach(doc => {
            const messageData = doc.data();
            // Handle potential null timestamps safely
            const createdAt = messageData.createdAt || admin.firestore.Timestamp.now();
            
            messages.push({
              id: doc.id,
              chatId,
              senderId: messageData.senderId,
              content: messageData.content,
              createdAt: createdAt,
              readBy: messageData.readBy || {},
              deleted: messageData.deleted || false
            });
          });
          
          // If we need more messages and there are earlier shards
          if (messages.length < pageSize && foundShardId > 0) {
            for (let shardId = foundShardId - 1; shardId >= 0 && messages.length < pageSize; shardId--) {
              const prevCollectionName = getMessageCollectionName(shardId * SHARD_SIZE);
              const remainingNeeded = pageSize - messages.length;
              
              const prevShardQuery = db.collection('messages')
                .doc(chatId)
                .collection(prevCollectionName)
                .orderBy('createdAt', 'desc')
                .limit(remainingNeeded);
              
              const prevShardSnapshot = await prevShardQuery.get();
              
              prevShardSnapshot.docs.forEach(doc => {
                const messageData = doc.data();
                // Handle potential null timestamps safely
                const createdAt = messageData.createdAt || admin.firestore.Timestamp.now();
                
                messages.push({
                  id: doc.id,
                  chatId,
                  senderId: messageData.senderId,
                  content: messageData.content,
                  createdAt: createdAt,
                  readBy: messageData.readBy || {},
                  deleted: messageData.deleted || false
                });
              });
            }
          }
          
          // Calculate last processed index
          lastProcessedIndex = messageCount - messages.length;
        } else {
          // If message not found, fall back to regular pagination (most recent messages)
          logger.warn(`Message ${startAfterMessageId} not found, falling back to regular pagination`);
        }
      }
      
      // If no messages loaded yet (either no startAfter or not found)
      if (messages.length === 0) {
        // Start from the most recent shard - Instagram style
        const latestShardId = Math.min(Math.floor((messageCount - 1) / SHARD_SIZE), MAX_SHARDS - 1);
        
        for (let shardId = latestShardId; shardId >= 0 && messages.length < pageSize; shardId--) {
          const collectionName = getMessageCollectionName(shardId * SHARD_SIZE);
          const remainingNeeded = pageSize - messages.length;
          
          const shardQuery = db.collection('messages')
            .doc(chatId)
            .collection(collectionName)
            .orderBy('createdAt', 'desc')
            .limit(remainingNeeded);
          
          const shardSnapshot = await shardQuery.get();
          
          shardSnapshot.docs.forEach(doc => {
            const messageData = doc.data();
            // Handle potential null timestamps safely
            const createdAt = messageData.createdAt || admin.firestore.Timestamp.now();
            
            messages.push({
              id: doc.id,
              chatId,
              senderId: messageData.senderId,
              content: messageData.content,
              createdAt: createdAt,
              readBy: messageData.readBy || {},
              deleted: messageData.deleted || false
            });
          });
        }
        
        // Calculate last processed index
        lastProcessedIndex = Math.min(pageSize, messageCount);
      }
      
      // Sort messages chronologically for the client
      messages.sort((a, b) => {
        // Safely handle timestamps that might be null or undefined
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return aTime - bTime;
      });
      
      return { 
        messages, 
        totalCount: messageCount,
        lastProcessedIndex
      };
    } catch (error) {
      logger.error(`Error getting messages for chat ${chatId}:`, error);
      // Add more details to the error message for better debugging
      const errorDetails = error instanceof Error ? error.message : String(error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to get messages: ${errorDetails}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Get or create a chat with another user
export const getOrCreateChat = functions
  .runWith({
    timeoutSeconds: 60, // Increased from 30 to 60
    memory: '512MB',   // Increased from 256MB to 512MB
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { otherUserId } = data;
    const userId = context.auth.uid;
    
    if (!otherUserId || typeof otherUserId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Other user ID is required'
      );
    }
    
    if (otherUserId === userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Cannot create chat with yourself'
      );
    }
    
    try {
      // Check if other user exists
      const otherUserRef = db.collection('users').doc(otherUserId);
      const otherUserDoc = await otherUserRef.get();
      
      if (!otherUserDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }
      
      // OPTIMIZATION: Use a more specific query to find existing chats
      // This is faster than querying all chats and filtering
      const existingChatQuery = await db.collection('messages')
        .where('participantArray', 'array-contains', userId)
        .where('isGroupChat', '==', false) // Only look for direct chats
        .get();
      
      // Find chat with both users
      for (const doc of existingChatQuery.docs) {
        const chatData = doc.data() as ChatDocument;
        
        if ((chatData.participants?.[otherUserId] || 
             chatData.participantArray?.includes(otherUserId))) {
          // Chat exists, return it with participant profiles
          const participantProfiles: Record<string, ChatParticipantProfile> = {};
          
          // Add other user's profile with null-safety
          const otherUserData = otherUserDoc.data();
          if (otherUserData) {
            participantProfiles[otherUserId] = {
              uid: otherUserId,
              displayName: otherUserData.displayName || null,
              photoURL: otherUserData.photoURL || null,
              handicapIndex: otherUserData.handicapIndex || null
            };
          }
          
          // Also ensure the chat has unreadCounters
          if (!chatData.unreadCounters) {
            await doc.ref.update({
              unreadCounters: {
                [userId]: 0,
                [otherUserId]: 0
              }
            });
            
            chatData.unreadCounters = {
              [userId]: 0,
              [otherUserId]: 0
            };
          }
          
          return {
            id: doc.id,
            ...chatData,
            participantProfiles
          };
        }
      }
      
      // Chat doesn't exist, create new chat
      const newChatRef = db.collection('messages').doc();
      
      // Create chat with minimal data
      const newChatData: ChatDocument = {
        participants: {
          [userId]: true,
          [otherUserId]: true
        },
        participantArray: [userId, otherUserId],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        isGroupChat: false,
        messageCount: 0,
        unreadCounters: {
          [userId]: 0,
          [otherUserId]: 0
        }
      };
      
      await newChatRef.set(newChatData);
      
      // Prepare participant profiles to return with null-safety
      const participantProfiles: Record<string, ChatParticipantProfile> = {};
      
      const otherUserData = otherUserDoc.data();
      if (otherUserData) {
        participantProfiles[otherUserId] = {
          uid: otherUserId,
          displayName: otherUserData.displayName || null,
          photoURL: otherUserData.photoURL || null,
          handicapIndex: otherUserData.handicapIndex || null
        };
      }
      
      return {
        id: newChatRef.id,
        ...newChatData,
        participantProfiles
      };
    } catch (error) {
      logger.error(`Error getting or creating chat with user ${otherUserId}:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get or create chat',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Get total unread messages count - highly optimized
export const getTotalUnreadCount = functions
  .runWith({
    timeoutSeconds: 20, // Increased from 10 to 20
    memory: '256MB',    // Increased from 128MB to 256MB
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    
    try {
      // OPTIMIZATION: Only get fields we need to reduce payload size
      const chatsQuery = await db.collection('messages')
        .where('participantArray', 'array-contains', userId)
        .select('unreadCounters') // Only select the unreadCounters field
        .get();
      
      // Sum up unread counters
      let totalUnread = 0;
      const unreadByChat: Record<string, number> = {};
      
      chatsQuery.docs.forEach(doc => {
        const chatData = doc.data();
        const unreadCount = chatData.unreadCounters?.[userId] || 0;
        
        if (unreadCount > 0) {
          unreadByChat[doc.id] = unreadCount;
          totalUnread += unreadCount;
        } else {
          // Always include all chats in result, even with 0 unread
          unreadByChat[doc.id] = 0;
        }
      });
      
      return { totalUnread, unreadByChat };
    } catch (error) {
      logger.error(`Error getting unread count for user ${userId}:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get unread count',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Search users with efficient error handling and case insensitivity
export const searchUsers = functions
  .runWith({
    timeoutSeconds: 20, // Increased from 10 to 20
    memory: '256MB',    // Increased from 128MB to 256MB
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { query, limit = 10 } = data;
    const userId = context.auth.uid;
    
    if (!query?.trim()) {
      return { users: [] };
    }
    
    try {
      const queryLower = query.toLowerCase();
      
      logger.info(`User ${userId} searching for users with query: "${queryLower}"`);
      
      // Define the type for users array explicitly
      interface UserResult {
        uid: string;
        displayName: string | null;
        photoURL: string | null;
        handicapIndex: number | null;
      }
      
      // First, try searching with displayNameLower for exact matches
      const exactMatches = await db.collection('users')
        .where('displayNameLower', '>=', queryLower)
        .where('displayNameLower', '<=', queryLower + '\uf8ff')
        .limit(limit)
        .get();
      
      let users: UserResult[] = [];
      
      if (!exactMatches.empty) {
        logger.info(`Found ${exactMatches.size} users using displayNameLower index`);
        
        users = exactMatches.docs.map(doc => {
          const data = doc.data();
          return {
            uid: doc.id,
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            handicapIndex: data.handicapIndex || null
          };
        });
      } else {
        // If no results with displayNameLower, try with displayName (case-sensitive)
        logger.info('No results with displayNameLower, trying with displayName');
        
        const displayNameMatches = await db.collection('users')
          .where('displayName', '>=', query)
          .where('displayName', '<=', query + '\uf8ff')
          .limit(limit)
          .get();
        
        if (!displayNameMatches.empty) {
          logger.info(`Found ${displayNameMatches.size} users using displayName`);
          
          users = displayNameMatches.docs.map(doc => {
            const data = doc.data();
            return {
              uid: doc.id,
              displayName: data.displayName || null,
              photoURL: data.photoURL || null,
              handicapIndex: data.handicapIndex || null
            };
          });
        }
      }
      
      // Filter out the current user
      users = users.filter(user => user.uid !== userId);
      
      logger.info(`Returning ${users.length} users for query "${queryLower}"`);
      
      return { users };
    } catch (error) {
      logger.error(`Error searching users with query "${query}":`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to search users',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Auto-update displayNameLower field when displayName changes
export const onUserUpdated = functions
  .firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    // Skip if document was deleted
    if (!change.after.exists) return;
    
    // Use our UserProfile interface here instead of generic DocumentData
    const userData = change.after.data() as UserProfile;
    const previousData = change.before.exists ? (change.before.data() as UserProfile | null) : null;
    
    // Check if displayName changed or displayNameLower is missing
    if (userData.displayName !== previousData?.displayName || 
        !(userData as any).displayNameLower) {
      
      // Only update if displayName exists
      if (userData.displayName) {
        await change.after.ref.update({
          displayNameLower: userData.displayName.toLowerCase()
        });
        
        logger.info(`Updated displayNameLower for user ${context.params.userId}`);
      }
    }
  });

// Optional: Auto-cleanup for deleted users
export const onUserDeleted = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .firestore
  .document('users/{userId}')
  .onDelete(async (snapshot, context) => {
    const userId = context.params.userId;
    
    try {
      logger.info(`User ${userId} was deleted, cleaning up chats`);
      
      // Find all chats where user is participant
      const chatsQuery = await db.collection('messages')
        .where('participantArray', 'array-contains', userId)
        .get();
      
      if (chatsQuery.empty) {
        logger.info(`No chats found for deleted user ${userId}`);
        return;
      }
      
      logger.info(`Found ${chatsQuery.size} chats to clean up for deleted user ${userId}`);
      
      // Process each chat
      const batch = db.batch();
      let operationCount = 0;
      
      for (const chatDoc of chatsQuery.docs) {
        const chatData = chatDoc.data() as ChatDocument;
        
        // If it's a group chat, just remove the user
        if (chatData.isGroupChat && Object.keys(chatData.participants || {}).length > 2) {
          const updatedParticipants = { ...chatData.participants };
          delete updatedParticipants[userId];
          
          const updatedArray = (chatData.participantArray || []).filter(id => id !== userId);
          
          batch.update(chatDoc.ref, {
            participants: updatedParticipants,
            participantArray: updatedArray,
            [`unreadCounters.${userId}`]: admin.firestore.FieldValue.delete()
          });
        } else {
          // For direct chats, mark them as archived but don't delete
          // This preserves conversation history for the other user
          batch.update(chatDoc.ref, {
            [`participants.${userId}`]: false,
            [`archivedBy.${userId}`]: true,
            [`unreadCounters.${userId}`]: admin.firestore.FieldValue.delete()
          });
        }
        
        operationCount++;
        
        // Commit when batch gets full
        if (operationCount >= 400) {
          await batch.commit();
          operationCount = 0;
        }
      }
      
      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }
      
      logger.info(`Successfully cleaned up chats for deleted user ${userId}`);
    } catch (error) {
      logger.error(`Error cleaning up chats for deleted user ${userId}:`, error);
    }
  });

// Function to check if a message was deleted
export const wasMessageDeleted = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId, messageId } = data;
    const userId = context.auth.uid;
    
    if (!chatId || !messageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID and message ID are required'
      );
    }
    
    try {
      // Verify user is a participant
      const chatDoc = await db.collection('messages').doc(chatId).get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Chat not found'
        );
      }
      
      const chatData = chatDoc.data() as ChatDocument;
      
      if (!chatData.participants?.[userId] && !chatData.participantArray?.includes(userId)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not a participant in this conversation'
        );
      }
      
      // Try to find the message in all possible collections
      const messageCount = chatData.messageCount || 0;
      const totalShards = Math.min(Math.floor(messageCount / SHARD_SIZE) + 1, MAX_SHARDS);
      
      for (let shardId = 0; shardId < totalShards; shardId++) {
        const collectionName = getMessageCollectionName(shardId * SHARD_SIZE);
        const messageRef = db.collection('messages')
          .doc(chatId)
          .collection(collectionName)
          .doc(messageId);
        
        const messageDoc = await messageRef.get();
        
        if (messageDoc.exists) {
          const messageData = messageDoc.data();
          return { 
            exists: true, 
            deleted: messageData?.deleted === true,
            senderId: messageData?.senderId
          };
        }
      }
      
      // Message not found in any collection
      return { exists: false };
    } catch (error) {
      logger.error(`Error checking if message ${messageId} was deleted:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to check message status',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

// Delete a message (soft delete)
export const deleteMessage = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { chatId, messageId } = data;
    const userId = context.auth.uid;
    
    if (!chatId || !messageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Chat ID and message ID are required'
      );
    }
    
    try {
      // Verify user is a participant
      const chatDoc = await db.collection('messages').doc(chatId).get();
      
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Chat not found'
        );
      }
      
      const chatData = chatDoc.data() as ChatDocument;
      
      if (!chatData.participants?.[userId] && !chatData.participantArray?.includes(userId)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not a participant in this conversation'
        );
      }
      
      // Find the message in the appropriate collection
      const messageCount = chatData.messageCount || 0;
      const totalShards = Math.min(Math.floor(messageCount / SHARD_SIZE) + 1, MAX_SHARDS);
      
      for (let shardId = 0; shardId < totalShards; shardId++) {
        const collectionName = getMessageCollectionName(shardId * SHARD_SIZE);
        const messageRef = db.collection('messages')
          .doc(chatId)
          .collection(collectionName)
          .doc(messageId);
        
        const messageDoc = await messageRef.get();
        
        if (messageDoc.exists) {
          const messageData = messageDoc.data();
          
          // Verify the user is the sender
          if (messageData?.senderId !== userId) {
            throw new functions.https.HttpsError(
              'permission-denied',
              'You can only delete your own messages'
            );
          }
          
          // Soft delete the message
          await messageRef.update({
            deleted: true,
            content: 'This message has been deleted',
            deletedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // If this is the last message in the chat, update the preview
          if (chatData.lastMessage?.messageId === messageId) {
            await db.collection('messages').doc(chatId).update({
              'lastMessage.content': 'This message has been deleted'
            });
          }
          
          return { success: true };
        }
      }
      
      // Message not found
      throw new functions.https.HttpsError(
        'not-found',
        'Message not found'
      );
    } catch (error) {
      logger.error(`Error deleting message ${messageId}:`, error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to delete message',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });
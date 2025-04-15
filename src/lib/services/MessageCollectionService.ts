/**
 * MessageCollectionService.ts
 * Central service for managing message collection sharding logic.
 * All sharding calculations should use this service to ensure consistency.
 */
import { doc, getDoc, collection, CollectionReference, DocumentReference, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Message } from '@/types/messages';

// Constants for sharding configuration
export const SHARD_SIZE = 500; // Maximum number of messages per shard
export const MAX_SHARDS = 20;  // Maximum number of shards per chat (10,000 messages)

export class MessageCollectionService {
  private static instance: MessageCollectionService;
  private messageCountCache: Record<string, number> = {};

  private constructor() {}

  public static getInstance(): MessageCollectionService {
    if (!MessageCollectionService.instance) {
      MessageCollectionService.instance = new MessageCollectionService();
    }
    return MessageCollectionService.instance;
  }

  /**
   * Gets the collection name for a specific message index or count
   * This is the canonical implementation that should be used everywhere
   */
  public getCollectionName(messageCount: number): string {
    const shardId = Math.floor(messageCount / SHARD_SIZE);
    // Enforce max shard limit to match security rules
    const limitedShardId = Math.min(shardId, MAX_SHARDS - 1);
    return limitedShardId > 0 ? `thread_${limitedShardId}` : 'thread';
  }

  /**
   * Gets the appropriate collection reference for a chat's messages
   * based on message count and sharding strategy
   */
  public async getMessageCollectionRef(chatId: string): Promise<{
    collectionRef: CollectionReference;
    collectionName: string;
    shardId: number;
  }> {
    try {
      const messageCount = await this.getMessageCount(chatId);
      const shardId = Math.min(Math.floor(messageCount / SHARD_SIZE), MAX_SHARDS - 1);
      const collectionName = this.getCollectionName(messageCount);
      
      return {
        collectionRef: collection(db, 'messages', chatId, collectionName),
        collectionName,
        shardId
      };
    } catch (error) {
      console.error(`Error getting message collection for chat ${chatId}:`, error);
      // Default to the main thread collection if there's an error
      return {
        collectionRef: collection(db, 'messages', chatId, 'thread'),
        collectionName: 'thread',
        shardId: 0
      };
    }
  }

  /**
   * Gets all collection references that may contain messages for a chat,
   * returned in order from oldest (shard 0) to newest
   */
  public async getAllMessageCollectionRefs(chatId: string): Promise<{
    collectionRef: CollectionReference;
    collectionName: string;
    shardId: number;
  }[]> {
    try {
      const messageCount = await this.getMessageCount(chatId);
      const totalShards = Math.min(
        Math.floor(messageCount / SHARD_SIZE) + 1, 
        MAX_SHARDS
      );
      
      const collections = [];
      
      // Add all shards in order from oldest to newest
      for (let i = 0; i < totalShards; i++) {
        const collectionName = i === 0 ? 'thread' : `thread_${i}`;
        collections.push({
          collectionRef: collection(db, 'messages', chatId, collectionName),
          collectionName,
          shardId: i
        });
      }
      
      return collections;
    } catch (error) {
      console.error(`Error getting all message collections for chat ${chatId}:`, error);
      // Return just the main thread collection if there's an error
      return [{
        collectionRef: collection(db, 'messages', chatId, 'thread'),
        collectionName: 'thread',
        shardId: 0
      }];
    }
  }

  /**
   * Gets the correct document reference for a message by searching all shards
   */
  public async getMessageDocRef(chatId: string, messageId: string): Promise<{
    docRef: DocumentReference;
    collectionName: string;
    shardId: number;
  }> {
    try {
      // Get all potential collections
      const collections = await this.getAllMessageCollectionRefs(chatId);
      
      // Find which collection contains the message
      for (const collection of collections) {
        const docRef = doc(db, 'messages', chatId, collection.collectionName, messageId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return {
            docRef,
            collectionName: collection.collectionName,
            shardId: collection.shardId
          };
        }
      }
      
      // If we couldn't find the message in any collection, default to the latest shard
      // This is a reasonable fallback for new messages or operations that don't require existing data
      const latestCollection = collections[collections.length - 1];
      return {
        docRef: doc(db, 'messages', chatId, latestCollection.collectionName, messageId),
        collectionName: latestCollection.collectionName,
        shardId: latestCollection.shardId
      };
    } catch (error) {
      console.error(`Error getting message document reference for ${messageId} in chat ${chatId}:`, error);
      // Default to the main thread collection
      return {
        docRef: doc(db, 'messages', chatId, 'thread', messageId),
        collectionName: 'thread',
        shardId: 0
      };
    }
  }

  /**
   * Gets the message count for a chat, with caching
   */
  public async getMessageCount(chatId: string): Promise<number> {
    // Check cache first
    if (this.messageCountCache[chatId] !== undefined) {
      return this.messageCountCache[chatId];
    }
    
    try {
      const chatDoc = await getDoc(doc(db, 'messages', chatId));
      
      if (!chatDoc.exists()) {
        this.messageCountCache[chatId] = 0;
        return 0;
      }
      
      const chatData = chatDoc.data();
      const messageCount = chatData.messageCount || 0;
      
      // Update cache
      this.messageCountCache[chatId] = messageCount;
      
      return messageCount;
    } catch (error) {
      console.error(`Error getting message count for chat ${chatId}:`, error);
      return 0;
    }
  }

  /**
   * Updates the cached message count for a chat
   */
  public updateCachedMessageCount(chatId: string, count: number): void {
    this.messageCountCache[chatId] = count;
  }

  /**
   * Invalidates the cached message count for a chat
   */
  public invalidateMessageCountCache(chatId: string): void {
    delete this.messageCountCache[chatId];
  }

  /**
   * Find a specific message across all shards - useful for pagination
   */
  public async findMessageAcrossShards(chatId: string, messageId: string): Promise<{
    message: Message | null;
    shardId: number;
    collectionName: string;
  }> {
    try {
      const collections = await this.getAllMessageCollectionRefs(chatId);
      
      for (const collection of collections) {
        const messageRef = doc(db, 'messages', chatId, collection.collectionName, messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (messageDoc.exists()) {
          return {
            message: {
              id: messageDoc.id,
              chatId,
              ...messageDoc.data()
            } as Message,
            shardId: collection.shardId,
            collectionName: collection.collectionName
          };
        }
      }
      
      return { message: null, shardId: -1, collectionName: '' };
    } catch (error) {
      console.error(`Error finding message ${messageId} across shards:`, error);
      return { message: null, shardId: -1, collectionName: '' };
    }
  }

  /**
   * Get the latest shard for a chat - useful for sending new messages
   */
  public async getLatestMessageShard(chatId: string): Promise<{
    collectionRef: CollectionReference;
    collectionName: string;
    shardId: number;
  }> {
    const messageCount = await this.getMessageCount(chatId);
    const shardId = Math.min(Math.floor(messageCount / SHARD_SIZE), MAX_SHARDS - 1);
    const collectionName = this.getCollectionName(messageCount);
    
    return {
      collectionRef: collection(db, 'messages', chatId, collectionName),
      collectionName,
      shardId
    };
  }
}
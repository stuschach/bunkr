"use strict"
//functions/lib/src/constants.ts

// Message sharding configuration
export const SHARD_SIZE = 500;  // Number of messages per shard
export const MAX_SHARDS = 20;   // Maximum number of shards (matches security rules)

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  USER_CHATS: 5 * 60 * 1000,       // 5 minutes
  CHAT: 5 * 60 * 1000,             // 5 minutes
  MESSAGES: 1 * 60 * 1000,         // 1 minute
  USER_PROFILE: 10 * 60 * 1000,    // 10 minutes
  UNREAD_COUNTS: 30 * 1000,        // 30 seconds
  MESSAGE_COUNT: 5 * 60 * 1000     // 5 minutes
};

// Cache key prefixes
export const CACHE_KEYS = {
  USER_CHATS: (userId: string) => `user_chats_${userId}`,
  CHAT: (chatId: string) => `chat_${chatId}`,
  MESSAGES: (chatId: string, pageSize: number) => `messages_${chatId}_${pageSize}`,
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
  UNREAD_COUNTS: (userId: string) => `unread_counts_${userId}`,
  MESSAGE_COUNT: (chatId: string) => `message_count_${chatId}`
};

// Message subscription ID generator
export const generateSubscriptionId = (chatId: string, userId: string): string => 
  `${chatId}_${userId}_${Date.now()}`;

// Maximum message content length
export const MAX_MESSAGE_LENGTH = 2000;

// Default pagination sizes
export const PAGINATION = {
  MESSAGES: 30,
  CHATS: 50,
  SEARCH_RESULTS: 10
};

// Timestamp formats
export const TIME_FORMATS = {
  CHAT_LIST: 'h:mm a',
  CHAT_LIST_OLDER: 'MMM d',
  MESSAGE: 'h:mm a',
  MESSAGE_DATE_DIVIDER: 'EEEE, MMMM d, yyyy'
};

// Deleted message placeholder text
export const DELETED_MESSAGE_TEXT = 'This message has been deleted';
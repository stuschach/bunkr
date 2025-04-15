// src/lib/utils/firebase-utils.ts

import { Timestamp } from 'firebase/firestore';

/**
 * Safely gets a timestamp in milliseconds from a Firebase timestamp or Date
 */
export const getTimestampMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  
  // Handle Firebase Timestamp
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate().getTime();
    } catch (error) {
      return 0;
    }
  }
  
  return 0;
};

/**
 * Safely converts a Firebase timestamp to a JavaScript Date
 */
export const toJsDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Handle Firebase Timestamp
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate();
    } catch (error) {
      return null;
    }
  }
  
  return null;
};

/**
 * Gets the last message content regardless of field name
 */
export const getLastMessageContent = (chat: any): string => {
  if (!chat.lastMessage) return '';
  
  // Handle different field names
  return chat.lastMessage.content || 
         chat.lastMessage.preview || 
         '';
};

/**
 * Gets the last message timestamp safely
 */
export const getLastMessageTimestamp = (chat: any): Date | null => {
  if (!chat.lastMessage) return null;
  
  // Handle different field names
  const timestamp = chat.lastMessage.createdAt || 
                   chat.lastMessage.timestamp;
  
  return toJsDate(timestamp);
};
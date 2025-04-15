/**
 * Utility functions for messages
 */
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Chat } from '@/types/messages';
import { TIME_FORMATS } from '@/lib/constants';
import { safeTimestampToDate } from './timestamp-utils';
import { Timestamp } from 'firebase/firestore';

/**
 * Format a timestamp for display in the message thread
 */
export function formatMessageTime(timestamp: Date | Timestamp | any): string {
  if (!timestamp) {
    return '';
  }
  
  // Convert to Date if it's a Timestamp
  const date = timestamp instanceof Date ? timestamp : safeTimestampToDate(timestamp);
  
  if (!date) {
    return '';
  }
  
  return format(date, TIME_FORMATS.MESSAGE);
}

/**
 * Format a timestamp for display in the chat list
 */
export function formatChatListTime(timestamp: Date | Timestamp | any): string {
  if (!timestamp) {
    return '';
  }
  
  // Convert to Date if it's a Timestamp
  const date = timestamp instanceof Date ? timestamp : safeTimestampToDate(timestamp);
  
  if (!date) {
    return '';
  }
  
  if (isToday(date)) {
    return format(date, TIME_FORMATS.CHAT_LIST);
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    // For older dates, show the date
    return format(date, TIME_FORMATS.CHAT_LIST_OLDER);
  }
}

/**
 * Check if the last message in a chat was sent by the current user
 */
export function isLastMessageFromCurrentUser(chat: Chat, userId: string): boolean {
  if (!chat || !chat.lastMessage || !userId) {
    return false;
  }
  
  return chat.lastMessage.senderId === userId;
}

/**
 * Truncate a message to a max length, adding ellipsis if needed
 */
export function truncateMessage(message: string, maxLength: number = 50): string {
  if (!message) {
    return '';
  }
  
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength) + '...';
}

/**
 * Get a formatted date string for message date dividers
 */
export function formatMessageDateDivider(date: Date): string {
  if (!date) {
    return '';
  }
  
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, TIME_FORMATS.MESSAGE_DATE_DIVIDER);
  }
}

/**
 * Get the time difference between now and a timestamp in a readable format
 * e.g. "2 hours ago", "3 days ago", etc.
 */
export function getTimeAgo(timestamp: Date | Timestamp | any): string {
  if (!timestamp) {
    return '';
  }
  
  // Convert to Date if it's a Timestamp
  const date = timestamp instanceof Date ? timestamp : safeTimestampToDate(timestamp);
  
  if (!date) {
    return '';
  }
  
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Check if a message is unread by a specific user
 */
export function isMessageUnread(message: any, userId: string): boolean {
  if (!message || !userId) {
    return false;
  }
  
  // If readBy doesn't exist or user isn't in readBy, message is unread
  return !message.readBy || !message.readBy[userId];
}

/**
 * Sort messages by timestamp in ascending order (oldest first)
 */
export function sortMessagesByTimestamp(messages: any[]): any[] {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }
  
  return [...messages].sort((a, b) => {
    const aTime = safeTimestampToDate(a.createdAt)?.getTime() || 0;
    const bTime = safeTimestampToDate(b.createdAt)?.getTime() || 0;
    return aTime - bTime;
  });
}

/**
 * Sort chats by last message timestamp in descending order (newest first)
 */
export function sortChatsByRecency(chats: Chat[]): Chat[] {
  if (!chats || !Array.isArray(chats)) {
    return [];
  }
  
  return [...chats].sort((a, b) => {
    // Get last message timestamp or use updatedAt as fallback
    const aLastMessageTime = a.lastMessage?.createdAt 
      ? safeTimestampToDate(a.lastMessage.createdAt)?.getTime() 
      : safeTimestampToDate(a.updatedAt)?.getTime() || 0;
      
    const bLastMessageTime = b.lastMessage?.createdAt 
      ? safeTimestampToDate(b.lastMessage.createdAt)?.getTime() 
      : safeTimestampToDate(b.updatedAt)?.getTime() || 0;
    
    return bLastMessageTime - aLastMessageTime;
  });
}
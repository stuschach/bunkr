import { Timestamp } from 'firebase/firestore';
import { UserProfile } from './auth';

/**
 * Simplified user profile for chat participants
 */
export interface SimplifiedUserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  handicapIndex: number | null;
}

/**
 * Chat document structure
 */
export interface Chat {
  id: string;
  participants: Record<string, boolean>;
  participantArray: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: Timestamp;
  };
  isGroupChat?: boolean;
  title?: string;
  messageCount: number;
  participantProfiles?: Record<string, SimplifiedUserProfile>;
  unreadCounters: Record<string, number>; // Required field for tracking unread messages
}

/**
 * Message structure
 */
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Timestamp;
  readBy: Record<string, boolean>;
  deleted?: boolean;
}

/**
 * Structure for client-side chat data with more detailed information
 */
export interface EnhancedChat extends Chat {
  otherParticipant?: SimplifiedUserProfile; // For direct chats
  unreadCount: number;  // Calculated field for the current user
  lastMessageText: string; // Formatted last message preview
  lastMessageTime: string; // Formatted time
}

/**
 * Type for unread message counts
 */
export interface UnreadCounts {
  totalUnread: number;
  unreadByChat: Record<string, number>;
}

/**
 * Message thread info with loading state
 */
export interface MessageThreadInfo {
  messages: Message[];
  loading: boolean;
  error: string | null;
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  hasMore: boolean;
  loading: boolean;
  page: number;
}

/**
 * Message batch for loading messages in chunks
 */
export interface MessageBatch {
  messages: Message[];
  totalCount: number;
  lastProcessedIndex: number;
}

/**
 * Parameters for message subscription
 */
export interface MessageSubscriptionParams {
  chatId: string;
  userId: string;
  onMessagesUpdate: (messages: Message[]) => void;
  onError?: (error: Error) => void;
}
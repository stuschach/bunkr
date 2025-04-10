import { formatDistanceToNow, format, isToday, isYesterday, isSameYear } from 'date-fns';
import { Chat, Message } from '@/types/messages';
import { UserProfile } from '@/types/auth';
import { Timestamp } from 'firebase/firestore';

/**
 * Format a timestamp for display in message contexts
 */
export function formatMessageTime(timestamp: Date | Timestamp | null): string {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  } else if (isSameYear(date, new Date())) {
    return format(date, 'MMM d, h:mm a');
  } else {
    return format(date, 'MMM d, yyyy, h:mm a');
  }
}

/**
 * Format a timestamp for display in chat lists 
 */
export function formatChatListTime(timestamp: Date | Timestamp | null): string {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else if (isSameYear(date, new Date())) {
    return format(date, 'MMM d');
  } else {
    return format(date, 'MM/dd/yy');
  }
}

/**
 * Get other participant info from a chat (for 1:1 chats)
 */
export function getOtherParticipant(chat: Chat, currentUserId: string): UserProfile | null {
  if (!chat.participantProfiles) return null;
  
  // Get the first participant who is not the current user
  const otherUserId = Object.keys(chat.participants).find(id => id !== currentUserId);
  
  if (!otherUserId) return null;
  
  return chat.participantProfiles[otherUserId];
}

/**
 * Get chat display name
 */
export function getChatName(chat: Chat, currentUserId: string): string {
  if (chat.isGroupChat && chat.title) {
    return chat.title;
  }
  
  const otherParticipant = getOtherParticipant(chat, currentUserId);
  return otherParticipant?.displayName || 'Unknown User';
}

/**
 * Get chat avatar (for display in chat list or header)
 */
export function getChatAvatar(chat: Chat, currentUserId: string): string | null {
  if (chat.isGroupChat) {
    // Group chats would have their own avatar in a real app
    return null;
  }
  
  const otherParticipant = getOtherParticipant(chat, currentUserId);
  return otherParticipant?.photoURL || null;
}

/**
 * Check if the last message in a chat was sent by the current user
 */
export function isLastMessageFromCurrentUser(chat: Chat, currentUserId: string): boolean {
  return chat.lastMessage?.senderId === currentUserId;
}

/**
 * Get count of unread messages in a chat
 */
export function getUnreadMessageCount(messages: Message[], currentUserId: string): number {
  return messages.filter(message => 
    message.senderId !== currentUserId && 
    (!message.readBy || !message.readBy[currentUserId])
  ).length;
}

/**
 * Sort chats by last message time (most recent first)
 */
export function sortChatsByRecent(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const aTime = a.updatedAt ? 
      (a.updatedAt instanceof Date ? a.updatedAt : a.updatedAt.toDate()) : 
      new Date(0);
    
    const bTime = b.updatedAt ? 
      (b.updatedAt instanceof Date ? b.updatedAt : b.updatedAt.toDate()) : 
      new Date(0);
    
    return bTime.getTime() - aTime.getTime();
  });
}

/**
 * Truncate message content for previews
 */
export function truncateMessage(content: string, maxLength: number = 40): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
// src/lib/utils/message-utils.ts
import { format, formatDistanceToNow } from 'date-fns';
import { Chat } from '@/types/messages';

// Format time for message display
export const formatMessageTime = (timestamp: any): string => {
  if (!timestamp) {
    return 'Just now';
  }
  
  try {
    const date = timestamp instanceof Date 
      ? timestamp 
      : timestamp.toDate?.() || new Date();
    
    return format(date, 'h:mm a');
  } catch (error) {
    return 'Just now';
  }
};

// Format time for chat list display
export const formatChatListTime = (timestamp: any): string => {
  if (!timestamp) {
    return 'Just now';
  }
  
  try {
    const date = timestamp instanceof Date 
      ? timestamp 
      : timestamp.toDate?.() || new Date();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
      return format(date, 'h:mm a'); // Today: show time
    } else if (date >= yesterday) {
      return 'Yesterday'; // Yesterday: show "Yesterday"
    } else {
      return format(date, 'MMM d'); // Earlier: show date
    }
  } catch (error) {
    return 'Just now';
  }
};

// Get chat name based on participants
export const getChatName = (chat: Chat, currentUserId: string): string => {
  if (chat.title) {
    return chat.title; // Use title for group chats
  }
  
  // Get the other participant
  const otherParticipant = getOtherParticipant(chat, currentUserId);
  
  if (otherParticipant) {
    return otherParticipant.displayName || 'Unknown User';
  }
  
  return 'Chat';
};

// Get chat avatar for display
export const getChatAvatar = (chat: Chat, currentUserId: string): string | null => {
  if (chat.isGroupChat) {
    return null; // Group chats don't have avatars
  }
  
  // Get the other participant
  const otherParticipant = getOtherParticipant(chat, currentUserId);
  
  if (otherParticipant) {
    return otherParticipant.photoURL;
  }
  
  return null;
};

// Get the other participant in a one-on-one chat
export const getOtherParticipant = (chat: Chat, currentUserId: string) => {
  if (!chat.participantProfiles) return null;
  
  // Get all participants
  const otherParticipantIds = Object.keys(chat.participants || {})
    .filter(id => id !== currentUserId);
  
  // Return the first other participant (only one in one-on-one chats)
  if (otherParticipantIds.length > 0) {
    return chat.participantProfiles[otherParticipantIds[0]];
  }
  
  return null;
};

// Check if the last message is from the current user
export const isLastMessageFromCurrentUser = (chat: Chat, currentUserId: string): boolean => {
  if (!chat.lastMessage) return false;
  
  return chat.lastMessage.senderId === currentUserId;
};

// Truncate message text for preview
export const truncateMessage = (message: string, maxLength: number): string => {
  if (!message) return '';
  
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength) + '...';
};
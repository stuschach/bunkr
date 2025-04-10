import { Timestamp } from 'firebase/firestore';
import { UserProfile } from './auth';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date | Timestamp;
  readBy: { [userId: string]: boolean };
  attachments?: MessageAttachment[];
  deleted?: boolean;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
}

export interface Chat {
  id: string;
  participants: { [userId: string]: boolean };
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: Date | Timestamp;
  };
  title?: string; // For group chats
  isGroupChat?: boolean;
  participantProfiles?: { [userId: string]: UserProfile };
}
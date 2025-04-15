// src/types/notification.ts
import { Timestamp } from 'firebase/firestore';
import { UserProfile } from './auth';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'mention' 
  | 'tee-time-invite'
  | 'tee-time-approved'
  | 'tee-time-request'
  | 'tee-time-cancelled'
  | 'round-shared'
  | 'message'
  // New golf-specific notification types
  | 'handicap-updated'
  | 'tournament-update'
  | 'friend-activity'
  | 'course-review';

export interface Notification {
  id: string;
  userId: string; 
  type: NotificationType;
  entityId: string;
  entityType: 'post' | 'tee-time' | 'profile' | 'round' | 'comment' | 'message' | 'tournament' | 'course';
  actorId: string;
  actor?: UserProfile;
  isRead: boolean;
  createdAt: Date | Timestamp;
  data?: {
    content?: string;
    title?: string;
    postContent?: string;
    courseName?: string;
    score?: number;
    date?: string | Date;
    tournamentName?: string;
    tournamentRound?: number;
    newHandicap?: number;
    previousHandicap?: number;
    courseRating?: number;
    reviewId?: string;
    [key: string]: any;
  };
  // Optional priority field for important notifications
  priority?: 'normal' | 'high';
}

// Updated notification preferences type with showToast property
export interface NotificationTypePreference {
  enabled: boolean;
  showToast: boolean;  // Added this property to fix the TypeScript error
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number; // 0-1 range
  toastEnabled: boolean; // Add this property to match DEFAULT_NOTIFICATION_PREFERENCES
  typePreferences: {
    [key in NotificationType]?: NotificationTypePreference;
  };
}

// Interface for toast notifications
export interface ToastNotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
  duration?: number;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  // New properties
  notificationPreferences: NotificationPreferences | null;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  hasNewNotifications: boolean;
  clearNewNotificationsFlag: () => void;
  // Toast notification method
  showNotification: (data: ToastNotificationData) => void;
}
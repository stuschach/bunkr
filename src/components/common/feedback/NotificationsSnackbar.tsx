// src/components/common/feedback/NotificationSnackbar.tsx
import React, { useEffect, useState } from 'react';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { useToast } from '@/lib/hooks/useToast';
import { Notification } from '@/types/notification';

interface NotificationSound {
  name: string;
  url: string;
}

const NOTIFICATION_SOUNDS: Record<string, NotificationSound> = {
  default: {
    name: 'Default',
    url: '/sounds/notification.mp3'
  },
  like: {
    name: 'Like',
    url: '/sounds/like.mp3'
  },
  comment: {
    name: 'Comment',
    url: '/sounds/comment.mp3'
  },
  follow: {
    name: 'Follow',
    url: '/sounds/follow.mp3'
  },
  teeTime: {
    name: 'Tee Time',
    url: '/sounds/tee-time.mp3'
  }
};

export function NotificationSnackbar() {
  const { 
    notifications, 
    hasNewNotifications, 
    clearNewNotificationsFlag,
    notificationPreferences
  } = useNotifications();
  
  const { showToast } = useToast();
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAudioElement(new Audio(NOTIFICATION_SOUNDS.default.url));
    }
    
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, []);
  
  // Get notification title based on type
  const getNotificationTitle = (notification: Notification): string => {
    const actorName = notification.actor?.displayName || 'Someone';
    
    switch (notification.type) {
      case 'like':
        if (notification.data?.postType === 'round') {
          return `${actorName} liked your round`;
        } else if (notification.data?.postType === 'tee-time') {
          return `${actorName} liked your tee time`;
        } else if (notification.data?.postType === 'photo') {
          return `${actorName} liked your photo`;
        } else if (notification.data?.postType === 'video') {
          return `${actorName} liked your video`;
        }
        return `${actorName} liked your post`;
      
      case 'comment':
        if (notification.data?.postType === 'round') {
          return `${actorName} commented on your round`;
        } else if (notification.data?.postType === 'tee-time') {
          return `${actorName} commented on your tee time`;
        } else if (notification.data?.postType === 'photo') {
          return `${actorName} commented on your photo`;
        } else if (notification.data?.postType === 'video') {
          return `${actorName} commented on your video`;
        }
        return `${actorName} commented on your post`;
      
      case 'follow':
        return `${actorName} started following you`;
      
      case 'mention':
        return `${actorName} mentioned you`;
      
      case 'tee-time-invite':
        return `${actorName} invited you to a tee time`;
      
      case 'tee-time-approved':
        return `Your tee time request was approved`;
      
      case 'tee-time-request':
        return `${actorName} requested to join your tee time`;
      
      case 'tee-time-cancelled':
        return 'A tee time you joined was cancelled';
      
      case 'round-shared':
        return `${actorName} shared a round`;
      
      case 'handicap-updated':
        return 'Your handicap has been updated';
      
      case 'tournament-update':
        return 'Tournament update';
      
      case 'friend-activity':
        return `${actorName} posted something new`;
      
      case 'course-review':
        return `${actorName} reviewed a course`;
      
      default:
        return 'New notification';
    }
  };
  
  // Get the appropriate sound for a notification type
  const getNotificationSound = (type: string): NotificationSound => {
    switch (type) {
      case 'like':
        return NOTIFICATION_SOUNDS.like;
      case 'comment':
        return NOTIFICATION_SOUNDS.comment;
      case 'follow':
        return NOTIFICATION_SOUNDS.follow;
      case 'tee-time-invite':
      case 'tee-time-approved':
      case 'tee-time-request':
      case 'tee-time-cancelled':
        return NOTIFICATION_SOUNDS.teeTime;
      default:
        return NOTIFICATION_SOUNDS.default;
    }
  };
  
  // Play notification sound
  const playNotificationSound = (type: string) => {
    if (!audioElement || !notificationPreferences?.soundEnabled) return;
    
    try {
      const sound = getNotificationSound(type);
      
      // Set volume based on preferences
      audioElement.volume = notificationPreferences?.soundVolume || 0.5;
      
      // Set source and play
      audioElement.src = sound.url;
      audioElement.play().catch(err => {
        console.warn('Failed to play notification sound:', err);
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };
  
  // Check for new notifications to display toast
  useEffect(() => {
    if (hasNewNotifications && notifications.length > 0 && notificationPreferences) {
      // Get first unread notification that hasn't been toasted yet
      const latestUnread = notifications.find(n => 
        !n.isRead && n.id !== lastNotifiedId
      );
      
      if (latestUnread) {
        // Check if toasts are enabled globally and for this type
        const toastEnabled = notificationPreferences.toastEnabled;
        const typePrefs = notificationPreferences.typePreferences[latestUnread.type];
        const showToastForType = typePrefs?.showToast !== false;
        
        if (toastEnabled && showToastForType) {
          // Create toast
          showToast({
            title: getNotificationTitle(latestUnread),
            description: latestUnread.data?.content || '',
            variant: latestUnread.priority === 'high' ? 'success' : 'info',
            duration: 5000
          });
          
          // Play sound
          playNotificationSound(latestUnread.type);
        }
        
        // Remember we've toasted this notification
        setLastNotifiedId(latestUnread.id);
        
        // Clear the new notifications flag
        clearNewNotificationsFlag();
      }
    }
  }, [hasNewNotifications, notifications, notificationPreferences, lastNotifiedId, clearNewNotificationsFlag, showToast]);
  
  // This component doesn't render anything visible
  return null;
}
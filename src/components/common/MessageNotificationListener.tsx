'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useStore } from '@/store';
import { MessagingService } from '@/lib/services/MessagingService';
import { CACHE_TTL } from '@/lib/services/CacheService';

/**
 * Global component that listens for message notifications
 * and updates the global store with unread message counts
 */
export function MessageNotificationListener() {
  const { user } = useAuth();
  const setUnreadMessageCount = useStore(state => state.setUnreadMessageCount);
  const messagingService = MessagingService.getInstance();

  useEffect(() => {
    if (!user) {
      setUnreadMessageCount(0);
      return;
    }

    console.log("MessageNotificationListener: Starting for user", user.uid);
    
    // Initial fetch of unread counts
    const fetchUnreadCount = async () => {
      try {
        const unreadCounts = await messagingService.getTotalUnreadCounts();
        console.log("MessageNotificationListener: Total unread messages:", unreadCounts.totalUnread);
        setUnreadMessageCount(unreadCounts.totalUnread);
      } catch (error) {
        console.error("Error fetching unread counts:", error);
      }
    };

    // Run initial count
    fetchUnreadCount();

    // Set up interval for polling (every 30 seconds)
    const intervalId = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      console.log("MessageNotificationListener: Cleaning up");
      clearInterval(intervalId);
    };
  }, [user, setUnreadMessageCount, messagingService]);

  // This component doesn't render anything
  return null;
}
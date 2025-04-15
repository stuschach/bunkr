// src/lib/contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Notification,
  NotificationType,
  ToastNotificationData,
  NotificationPreferences
} from '@/types/notification';

// Define NotificationFilter type
type NotificationFilter = 'all' | 'read' | 'unread' | NotificationType;

// Define type for the context
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  filter: NotificationFilter;
  notificationPreferences: NotificationPreferences | null;
  hasNewNotifications: boolean;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  setFilter: (filter: NotificationFilter) => void;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  clearNewNotificationsFlag: () => void;
  showNotification: (data: ToastNotificationData) => void;
}

// Default notification preferences
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  soundVolume: 0.5,
  typePreferences: {
    like: { enabled: true },
    comment: { enabled: true },
    follow: { enabled: true },
    mention: { enabled: true },
    'tee-time-invite': { enabled: true },
    'tee-time-approved': { enabled: true },
    'tee-time-request': { enabled: true },
    'tee-time-cancelled': { enabled: true },
    'round-shared': { enabled: true },
    message: { enabled: true },
    'handicap-updated': { enabled: true },
    'tournament-update': { enabled: true },
    'friend-activity': { enabled: true },
    'course-review': { enabled: true }
  }
};

// Create the context with default values
const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  filter: 'all',
  notificationPreferences: null,
  hasNewNotifications: false,
  
  // Default no-op functions
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  refreshNotifications: async () => {},
  setFilter: () => {},
  updateNotificationPreferences: async () => {},
  clearNewNotificationsFlag: () => {},
  showNotification: () => {}
});

// Props for the provider component
interface NotificationProviderProps {
  children: ReactNode;
}

// Create the provider component
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State for notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);
  
  // Track if we should refetch notifications
  const [shouldFetch, setShouldFetch] = useState<boolean>(true);
  
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = React.useRef<boolean>(true);
  
  // Clear error helper
  const clearError = useCallback(() => setError(null), []);
  
  // Clear new notifications flag
  const clearNewNotificationsFlag = useCallback(() => {
    setHasNewNotifications(false);
  }, []);
  
  // Show toast notification
  const showNotification = useCallback((data: ToastNotificationData) => {
    // Implementation would depend on your toast notification system
    console.log('Toast notification:', data);
    // For example, if using react-toastify:
    // toast(data.description, { type: data.type, autoClose: data.duration || 3000 });
  }, []);
  
  // Get user notifications from the API
  const getUserNotifications = useCallback(async (userId: string): Promise<Notification[]> => {
    // This would be an actual API call in a real implementation
    // For now, return mock data
    return [
      {
        id: '1',
        userId: userId,
        type: 'like',
        entityId: 'post123',
        entityType: 'post',
        actorId: 'user456',
        isRead: false,
        createdAt: new Date(),
        data: {
          content: 'Great round yesterday!'
        }
      },
      {
        id: '2',
        userId: userId,
        type: 'comment',
        entityId: 'post456',
        entityType: 'post',
        actorId: 'user789',
        isRead: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      }
    ];
  }, []);
  
  // Get user notification preferences
  const getUserNotificationPreferences = useCallback(async (userId: string): Promise<NotificationPreferences> => {
    // This would be an actual API call in a real implementation
    // For now, return default preferences
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }, []);
  
  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      // In a real app, this would be an API call
      // Example: await firestoreService.updateNotification(notificationId, { isRead: true });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (err) {
      setError('Failed to mark notification as read');
      console.error('Error marking notification as read:', err);
    }
  }, [user]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      // In a real app, this would be an API call
      // Example: await firestoreService.markAllNotificationsAsRead(user.uid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
      
    } catch (err) {
      setError('Failed to mark all notifications as read');
      console.error('Error marking all notifications as read:', err);
    }
  }, [user]);
  
  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      // In a real app, this would be an API call
      // Example: await firestoreService.deleteNotification(notificationId);
      
      // Update local state
      setNotifications(prev => {
        const updatedNotifications = prev.filter(
          notification => notification.id !== notificationId
        );
        
        // Recalculate unread count
        const unreadNotifications = updatedNotifications.filter(n => !n.isRead);
        setUnreadCount(unreadNotifications.length);
        
        return updatedNotifications;
      });
      
    } catch (err) {
      setError('Failed to delete notification');
      console.error('Error deleting notification:', err);
    }
  }, [user]);
  
  // Update notification preferences
  const updateNotificationPreferences = useCallback(async (preferences: Partial<NotificationPreferences>) => {
    if (!user || !notificationPreferences) return;
    
    try {
      const updatedPreferences = {
        ...notificationPreferences,
        ...preferences
      };
      
      // In a real app, this would be an API call
      // Example: await firestoreService.updateNotificationPreferences(user.uid, updatedPreferences);
      
      // Update local state
      setNotificationPreferences(updatedPreferences);
      
    } catch (err) {
      setError('Failed to update notification preferences');
      console.error('Error updating notification preferences:', err);
    }
  }, [user, notificationPreferences]);
  
  // Function to refresh notifications - uses shouldFetch state to trigger the useEffect
  const refreshNotifications = useCallback(async () => {
    setShouldFetch(true);
  }, []);
  
  // Load notification preferences when user changes
  useEffect(() => {
    if (!user) return;
    
    const loadPreferences = async () => {
      try {
        const prefs = await getUserNotificationPreferences(user.uid);
        
        if (isMountedRef.current) {
          setNotificationPreferences(prefs);
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      }
    };
    
    loadPreferences();
  }, [user, getUserNotificationPreferences]);
  
  // Fetch notifications when user changes or shouldFetch is true
  useEffect(() => {
    // Don't fetch if no user or shouldFetch is false
    if (!user || !shouldFetch) return;
    
    // Reset the fetch flag immediately to prevent loops
    setShouldFetch(false);
    
    const fetchNotifications = async () => {
      if (!isMountedRef.current) return;
      
      setIsLoading(true);
      clearError();
      
      try {
        const fetchedNotifications = await getUserNotifications(user.uid);
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          // Check if there are new unread notifications
          const previousUnreadCount = unreadCount;
          const newUnreadCount = fetchedNotifications.filter(n => !n.isRead).length;
          
          if (newUnreadCount > previousUnreadCount) {
            setHasNewNotifications(true);
          }
          
          setNotifications(fetchedNotifications);
          setUnreadCount(newUnreadCount);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
        
        if (isMountedRef.current) {
          setError('Failed to load notifications');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    fetchNotifications();
    
  }, [user, shouldFetch, getUserNotifications, unreadCount, clearError]);
  
  // Set up cleanup for unmounting
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Set up a refresh interval for notifications
  useEffect(() => {
    if (!user) return;
    
    // Refresh notifications every 5 minutes
    const intervalId = setInterval(() => {
      refreshNotifications();
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [user, refreshNotifications]);
  
  // Filter the notifications based on the current filter
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    
    // Filter by notification type
    return notification.type === filter;
  });
  
  // Context value
  const value: NotificationContextType = {
    notifications: filteredNotifications,
    unreadCount,
    isLoading,
    error,
    filter,
    notificationPreferences,
    hasNewNotifications,
    
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    setFilter,
    updateNotificationPreferences,
    clearNewNotificationsFlag,
    showNotification
  };
  
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Export both singular and plural versions of the hook to ensure compatibility
export const useNotification = () => useContext(NotificationContext);
export const useNotifications = () => useContext(NotificationContext);
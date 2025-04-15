// src/lib/contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Notification,
  NotificationType,
  ToastNotificationData,
  NotificationPreferences
} from '@/types/notification';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cacheService } from '@/lib/services/CacheService';
import { UserProfile } from 'firebase/auth';

// Define NotificationFilter type
type NotificationFilter = 'all' | 'read' | 'unread' | NotificationType;

// Define type for the context
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  filter: NotificationFilter;
  notificationPreferences: NotificationPreferences | null;
  hasNewNotifications: boolean;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  setFilter: (filter: NotificationFilter) => void;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  clearNewNotificationsFlag: () => void;
  showNotification: (data: ToastNotificationData) => void;
}

// Default notification preferences
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  soundVolume: 0.5,
  toastEnabled: true,
  typePreferences: {
    like: { enabled: true, showToast: true },
    comment: { enabled: true, showToast: true },
    follow: { enabled: true, showToast: true },
    mention: { enabled: true, showToast: true },
    'tee-time-invite': { enabled: true, showToast: true },
    'tee-time-approved': { enabled: true, showToast: true },
    'tee-time-request': { enabled: true, showToast: true },
    'tee-time-cancelled': { enabled: true, showToast: true },
    'round-shared': { enabled: true, showToast: true },
    message: { enabled: true, showToast: true },
    'handicap-updated': { enabled: true, showToast: true },
    'tournament-update': { enabled: true, showToast: true },
    'friend-activity': { enabled: true, showToast: false },
    'course-review': { enabled: true, showToast: false }
  }
};

// Create the context with default values
const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  filter: 'all',
  notificationPreferences: null,
  hasNewNotifications: false,
  
  // Default no-op functions
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  fetchNotifications: async () => {},
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);
  
  // Track if we should refetch notifications
  const [shouldFetch, setShouldFetch] = useState<boolean>(true);
  
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);
  
  // Unsubscribe function for real-time listener
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // FIX: Add ref to track previous notification IDs
  const prevNotificationIdsRef = useRef<Set<string>>(new Set());
  
  // Clear error helper
  const clearError = useCallback(() => setError(null), []);
  
  // Clear new notifications flag
  const clearNewNotificationsFlag = useCallback(() => {
    setHasNewNotifications(false);
  }, []);
  
  // Show toast notification
  const showNotification = useCallback((data: ToastNotificationData) => {
    // This implementation would depend on your toast system
    console.log('Notification toast:', data);
    // For example, you could use your useToast hook here:
    // const { showToast } = useToast();
    // showToast({...data});
  }, []);
  
  // Get user notifications from Firestore
  const getUserNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!user) return [];
    
    const cacheKey = `notifications_${user.uid}`;
    
    try {
      // Try to get from cache first
      const cachedData = await cacheService.get<Notification[]>(cacheKey);
      if (cachedData) {
        console.log('Using cached notifications');
        return cachedData;
      }
      
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50) // Limit to most recent 50
      );
      
      const notificationsSnapshot = await getDocs(notificationsQuery);
      
      // Get all unique actorIds to fetch in batch
      const actorIds = new Set<string>();
      notificationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.actorId) {
          actorIds.add(data.actorId);
        }
      });
      
      // Fetch all actors in parallel
      const actorsMap: Record<string, UserProfile> = {};
      await Promise.all(Array.from(actorIds).map(async (actorId) => {
        try {
          const actorDoc = await getDoc(doc(db, 'users', actorId));
          if (actorDoc.exists()) {
            actorsMap[actorId] = {
              uid: actorId,
              ...actorDoc.data()
            } as UserProfile;
          }
        } catch (error) {
          console.error('Error fetching actor:', error);
        }
      }));
      
      // Create notification objects with actor data
      const notificationData = notificationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type as NotificationType,
          entityId: data.entityId,
          entityType: data.entityType,
          actorId: data.actorId,
          actor: data.actorId ? actorsMap[data.actorId] : undefined, // Use fetched actor data
          isRead: data.isRead || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          data: data.data || {},
          priority: data.priority || 'normal'
        } as Notification;
      });
      
      // Cache the notifications
      cacheService.set(cacheKey, notificationData, { ttl: 5 * 60 * 1000 }); // 5 min TTL
      
      return notificationData;
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
      return [];
    }
  }, [user]);
  
  // Get user notification preferences
  const getUserNotificationPreferences = useCallback(async (): Promise<NotificationPreferences> => {
    if (!user) return DEFAULT_NOTIFICATION_PREFERENCES;
    
    const cacheKey = `notification_prefs_${user.uid}`;
    
    try {
      // Try cache first
      const cachedPrefs = await cacheService.get<NotificationPreferences>(cacheKey);
      if (cachedPrefs) {
        return cachedPrefs;
      }
      
      const prefsDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'notifications'));
      
      if (prefsDoc.exists()) {
        const prefs = prefsDoc.data() as NotificationPreferences;
        
        // Cache the preferences
        cacheService.set(cacheKey, prefs, { ttl: 60 * 60 * 1000 }); // 1 hour TTL
        
        return prefs;
      } else {
        // Create default preferences if they don't exist
        try {
          const batch = writeBatch(db);
          
          // Create settings subcollection if it doesn't exist
          const settingsRef = doc(db, 'users', user.uid, 'settings', 'notifications');
          batch.set(settingsRef, DEFAULT_NOTIFICATION_PREFERENCES);
          
          await batch.commit();
          
          // Cache the preferences
          cacheService.set(cacheKey, DEFAULT_NOTIFICATION_PREFERENCES, { ttl: 60 * 60 * 1000 });
          
          return DEFAULT_NOTIFICATION_PREFERENCES;
        } catch (error) {
          console.error('Error creating notification preferences:', error);
          return DEFAULT_NOTIFICATION_PREFERENCES;
        }
      }
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }, [user]);
  
  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      // Update in Firestore
      await updateDoc(
        doc(db, 'notifications', notificationId),
        { isRead: true }
      );
      
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
      
      // Also update user profile unread counter
      if (unreadCount > 0) {
        await updateDoc(doc(db, 'users', user.uid), {
          unreadNotifications: Math.max(0, unreadCount - 1)
        });
      }
      
      // Update cache
      const cacheKey = `notifications_${user.uid}`;
      const cachedData = await cacheService.get<Notification[]>(cacheKey);
      if (cachedData) {
        const updatedCache = cachedData.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        );
        cacheService.set(cacheKey, updatedCache, { ttl: 5 * 60 * 1000 });
      }
    } catch (err) {
      setError('Failed to mark notification as read');
      console.error('Error marking notification as read:', err);
    }
  }, [user, unreadCount]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      // Get all unread notifications
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('isRead', '==', false)
      );
      
      const unreadSnapshot = await getDocs(unreadQuery);
      
      // Use batched write for efficiency
      const batch = writeBatch(db);
      
      unreadSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update user profile unread counter
      await updateDoc(doc(db, 'users', user.uid), {
        unreadNotifications: 0
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
      
      // Update cache
      const cacheKey = `notifications_${user.uid}`;
      const cachedData = await cacheService.get<Notification[]>(cacheKey);
      if (cachedData) {
        const updatedCache = cachedData.map(notification => ({ ...notification, isRead: true }));
        cacheService.set(cacheKey, updatedCache, { ttl: 5 * 60 * 1000 });
      }
    } catch (err) {
      setError('Failed to mark all notifications as read');
      console.error('Error marking all notifications as read:', err);
    }
  }, [user]);
  
  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'notifications', notificationId));
      
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
      
      // Update cache
      const cacheKey = `notifications_${user.uid}`;
      const cachedData = await cacheService.get<Notification[]>(cacheKey);
      if (cachedData) {
        const updatedCache = cachedData.filter(n => n.id !== notificationId);
        cacheService.set(cacheKey, updatedCache, { ttl: 5 * 60 * 1000 });
      }
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
      
      // Update in Firestore
      await updateDoc(
        doc(db, 'users', user.uid, 'settings', 'notifications'),
        updatedPreferences
      );
      
      // Update local state
      setNotificationPreferences(updatedPreferences);
      
      // Update cache
      const cacheKey = `notification_prefs_${user.uid}`;
      cacheService.set(cacheKey, updatedPreferences, { ttl: 60 * 60 * 1000 });
    } catch (err) {
      setError('Failed to update notification preferences');
      console.error('Error updating notification preferences:', err);
    }
  }, [user, notificationPreferences]);
  
  // Function to fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    clearError();
    
    try {
      const fetchedNotifications = await getUserNotifications();
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setNotifications(fetchedNotifications);
        
        // Calculate unread count
        const unreadCount = fetchedNotifications.filter(n => !n.isRead).length;
        setUnreadCount(unreadCount);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      
      if (isMountedRef.current) {
        setError('Failed to load notifications');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, getUserNotifications, clearError]);
  
  // Setup real-time notification listener
  useEffect(() => {
    if (!user) return;
    
    // Clean up previous listener if exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Create the query for notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(notificationsQuery, async (snapshot) => {
      if (!isMountedRef.current) return;
      
      // Track if we have new unread notifications
      let newUnreadCount = 0;
      let hasNewUnread = false;
      
      // FIX: Use the ref for previous IDs instead of current state
      const previousNotificationIds = prevNotificationIdsRef.current;
      
      // Get all unique actorIds to fetch in batch
      const actorIds = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.actorId) {
          actorIds.add(data.actorId);
        }
      });
      
      // Fetch all actors in parallel
      const actorsMap: Record<string, UserProfile> = {};
      await Promise.all(Array.from(actorIds).map(async (actorId) => {
        try {
          const actorDoc = await getDoc(doc(db, 'users', actorId));
          if (actorDoc.exists()) {
            actorsMap[actorId] = {
              uid: actorId,
              ...actorDoc.data()
            } as UserProfile;
          }
        } catch (error) {
          console.error('Error fetching actor:', error);
        }
      }));
      
      // Process the snapshot data
      const notificationData = snapshot.docs.map(doc => {
        const data = doc.data();
        const isRead = data.isRead || false;
        
        // Count unread
        if (!isRead) {
          newUnreadCount++;
        }
        
        // Check if this is a new notification
        if (!previousNotificationIds.has(doc.id) && !isRead) {
          hasNewUnread = true;
        }
        
        return {
          id: doc.id,
          userId: data.userId,
          type: data.type as NotificationType,
          entityId: data.entityId,
          entityType: data.entityType,
          actorId: data.actorId,
          actor: data.actorId ? actorsMap[data.actorId] : undefined, // Use fetched actor data
          isRead,
          createdAt: data.createdAt?.toDate() || new Date(),
          data: data.data || {},
          priority: data.priority || 'normal'
        } as Notification;
      });
      
      // FIX: Update the ref with new IDs
      prevNotificationIdsRef.current = new Set(notificationData.map(n => n.id));
      
      // Update state
      setNotifications(notificationData);
      setUnreadCount(newUnreadCount);
      
      // Set the new notification flag if we have new unread
      if (hasNewUnread) {
        setHasNewNotifications(true);
        
        // Update cache
        const cacheKey = `notifications_${user.uid}`;
        cacheService.set(cacheKey, notificationData, { ttl: 5 * 60 * 1000 });
      }
    }, (error) => {
      console.error('Error in notification listener:', error);
      if (isMountedRef.current) {
        setError('Failed to listen for new notifications');
      }
    });
    
    // Store the unsubscribe function
    unsubscribeRef.current = unsubscribe;
    
    // Fetch initial notifications
    fetchNotifications();
    
    // Clean up on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, fetchNotifications]);
  
  // Load notification preferences when user changes
  useEffect(() => {
    if (!user) return;
    
    const loadPreferences = async () => {
      try {
        const prefs = await getUserNotificationPreferences();
        
        if (isMountedRef.current) {
          setNotificationPreferences(prefs);
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      }
    };
    
    loadPreferences();
  }, [user, getUserNotificationPreferences]);
  
  // Set up cleanup for unmounting
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
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
    loading,
    error,
    filter,
    notificationPreferences,
    hasNewNotifications,
    
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
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

// Export hook for using the notification context
export const useNotifications = () => useContext(NotificationContext);
// src/lib/contexts/NotificationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification as deleteNotificationService,
  subscribeToNotifications
} from '@/lib/services/notifications-service';
import { 
  Notification, 
  NotificationContextType, 
  NotificationPreferences,
  ToastNotificationData
} from '@/types/notification';

// Set default context with proper typing
const defaultContext: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  fetchNotifications: async () => {},
  markAsRead: async (notificationId: string) => {},
  markAllAsRead: async () => {},
  deleteNotification: async (notificationId: string) => {},
  notificationPreferences: null,
  updateNotificationPreferences: async (preferences: Partial<NotificationPreferences>) => {},
  hasNewNotifications: false,
  clearNewNotificationsFlag: () => {},
  showNotification: () => {} // Add default implementation
};

// Create context with explicit typing
const NotificationContext = createContext<NotificationContextType>(defaultContext);

// Provider component
export const NotificationProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  
  // Add toast state
  const [toast, setToast] = useState<(ToastNotificationData & { visible: boolean }) | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Fetch notifications on user change
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchNotificationPreferences();
      
      // Subscribe to real-time notifications
      const unsubscribe = subscribeToNotifications(user.uid, (updatedNotifications) => {
        setNotifications(updatedNotifications);
        
        // Update unread count
        const unreadNotifications = updatedNotifications.filter(n => !n.isRead);
        setUnreadCount(unreadNotifications.length);
        
        // Check if there are new notifications
        if (unreadNotifications.length > 0) {
          // Compare to see if we have new notifications since last update
          const lastNotificationTime = localStorage.getItem('lastNotificationTime');
          if (lastNotificationTime) {
            const newestNotification = updatedNotifications.reduce((newest, current) => {
              const currentTime = current.createdAt instanceof Date 
                ? current.createdAt 
                : new Date(current.createdAt.seconds * 1000);
              const newestTime = newest.createdAt instanceof Date 
                ? newest.createdAt 
                : new Date(newest.createdAt.seconds * 1000);
              
              return currentTime > newestTime ? current : newest;
            }, updatedNotifications[0]);
            
            const newestTime = newestNotification.createdAt instanceof Date 
              ? newestNotification.createdAt 
              : new Date(newestNotification.createdAt.seconds * 1000);
              
            if (newestTime.getTime() > parseInt(lastNotificationTime)) {
              setHasNewNotifications(true);
            }
          }
          
          // Update last notification time
          const now = new Date().getTime().toString();
          localStorage.setItem('lastNotificationTime', now);
        }
      });
      
      return () => {
        unsubscribe();
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
    }
  }, [user]);
  
  // Fetch notification preferences
  const fetchNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      // For now, just use default preferences. In the future, fetch from Firebase
      // This would connect to a firestore collection to get user-specific preferences
      const defaultPreferences: NotificationPreferences = {
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
      
      setNotificationPreferences(defaultPreferences);
      
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
    }
  };
  
  // Update notification preferences
  const updateNotificationPreferences = async (preferences: Partial<NotificationPreferences>) => {
    if (!user) return;
    
    try {
      // Update state with new preferences
      setNotificationPreferences(prev => {
        const updated = { ...prev, ...preferences } as NotificationPreferences;
        
        // Save to local storage for now, later will save to Firestore
        localStorage.setItem('notificationPreferences', JSON.stringify(updated));
        
        return updated;
      });
      
      // In the future, save to Firestore
      // const userRef = doc(db, 'users', user.uid);
      // await updateDoc(userRef, { notificationPreferences: preferences });
      
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      setError('Failed to update notification preferences');
    }
  };
  
  // Fetch all notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedNotifications = await getUserNotifications(user.uid);
      setNotifications(fetchedNotifications);
      
      // Update unread count
      const unreadNotifications = fetchedNotifications.filter(n => !n.isRead);
      setUnreadCount(unreadNotifications.length);
      
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };
  
  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(prev - 1, 0));
      
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await markAllNotificationsAsRead(user.uid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
      
      // Reset unread count
      setUnreadCount(0);
      
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark all notifications as read');
    }
  };
  
  // Delete a notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteNotificationService(notificationId);
      
      // Update local state
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(prev - 1, 0));
      }
      
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  };
  
  // Clear the new notifications flag
  const clearNewNotificationsFlag = () => {
    setHasNewNotifications(false);
  };
  
  // Add the showNotification function for toast notifications
  const showNotification = (data: ToastNotificationData) => {
    // Clear any existing timeout
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
      setToastTimeoutId(null);
    }
    
    // Show the toast
    setToast({
      ...data,
      visible: true
    });
    
    // Auto-hide after duration
    const timeoutId = setTimeout(() => {
      setToast(prev => prev ? { ...prev, visible: false } : null);
      
      // Remove from DOM after animation
      setTimeout(() => {
        setToast(null);
      }, 300); // Animation duration
    }, data.duration || 5000);
    
    setToastTimeoutId(timeoutId);
  };
  
  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        notificationPreferences,
        updateNotificationPreferences,
        hasNewNotifications,
        clearNewNotificationsFlag,
        showNotification // Add the new function
      }}
    >
      {children}
      
      {/* Toast UI component */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${
          toast.visible ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`p-4 rounded-lg shadow-lg max-w-md ${
            toast.type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' :
            toast.type === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-700' :
            toast.type === 'warning' ? 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700' :
            'bg-blue-100 border-l-4 border-blue-500 text-blue-700'
          }`}>
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-medium">{toast.title}</h3>
                {toast.description && (
                  <p className="text-sm mt-1">{toast.description}</p>
                )}
              </div>
              <button 
                onClick={() => setToast(prev => prev ? { ...prev, visible: false } : null)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

// Export both hook names for backward compatibility
export const useNotifications = () => useContext(NotificationContext);
export const useNotification = () => useContext(NotificationContext); // Alias for backward compatibility
// src/lib/contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastProps } from '@/components/common/feedback/Toast';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Show a notification
  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-dismiss after duration (if provided)
    if (notification.duration !== Infinity) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  }, []);

  // Remove a notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        removeNotification,
      }}
    >
      {children}
      
      {/* Render active toasts */}
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          open={true}
          onClose={() => removeNotification(notification.id)}
          variant={notification.type}
          title={notification.title}
          description={notification.description}
          duration={notification.duration}
          position="top-right"
        />
      ))}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Convenience hooks for different notification types
export const useSuccessNotification = () => {
  const { showNotification } = useNotification();
  return useCallback(
    (title: string, description?: string, duration?: number) => {
      showNotification({ type: 'success', title, description, duration });
    },
    [showNotification]
  );
};

export const useErrorNotification = () => {
  const { showNotification } = useNotification();
  return useCallback(
    (title: string, description?: string, duration?: number) => {
      showNotification({ type: 'error', title, description, duration });
    },
    [showNotification]
  );
};

export const useWarningNotification = () => {
  const { showNotification } = useNotification();
  return useCallback(
    (title: string, description?: string, duration?: number) => {
      showNotification({ type: 'warning', title, description, duration });
    },
    [showNotification]
  );
};

export const useInfoNotification = () => {
  const { showNotification } = useNotification();
  return useCallback(
    (title: string, description?: string, duration?: number) => {
      showNotification({ type: 'info', title, description, duration });
    },
    [showNotification]
  );
};
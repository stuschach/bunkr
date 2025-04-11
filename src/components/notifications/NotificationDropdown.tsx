// src/components/notifications/NotificationDropdown.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils/cn';
import { Notification, NotificationType } from '@/types/notification';
import { Tabs } from '@/components/ui/Tabs';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

// Group notification types for filtering
interface NotificationCategory {
  id: string;
  label: string;
  types: NotificationType[];
  icon: React.ReactNode;
}

const notificationCategories: NotificationCategory[] = [
  {
    id: 'all',
    label: 'All',
    types: [] as NotificationType[], // Empty means all types
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
          clipRule="evenodd"
        />
      </svg>
    )
  },
  {
    id: 'social',
    label: 'Social',
    types: ['like', 'comment', 'follow', 'mention'],
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
        />
      </svg>
    )
  },
  {
    id: 'tee-times',
    label: 'Tee Times',
    types: ['tee-time-invite', 'tee-time-approved', 'tee-time-request', 'tee-time-cancelled'],
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    )
  },
  {
    id: 'golf',
    label: 'Golf',
    types: ['round-shared', 'handicap-updated', 'tournament-update', 'course-review', 'friend-activity'],
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 8l-3.293-3.293A1 1 0 0112 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
];

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const { notifications, unreadCount, loading, markAllAsRead } = useNotifications();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Filter notifications based on active category
  const filteredNotifications = notifications.filter(notification => {
    if (activeCategory === 'all') return true;
    
    const category = notificationCategories.find(cat => cat.id === activeCategory);
    return category ? category.types.includes(notification.type) : true;
  });

  // Limit to recent notifications for the dropdown
  const recentNotifications = filteredNotifications.slice(0, 5);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle "View All" click
  const handleViewAll = () => {
    router.push('/notifications');
    onClose();
  };

  // Handle "Mark All as Read" click
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };
  
  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-800 z-50 overflow-hidden"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h3 className="font-medium text-lg">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-green-500 hover:text-green-600 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>
      
      {/* Category tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {notificationCategories.map((category) => (
          <button
            key={category.id}
            className={cn(
              "flex items-center justify-center text-xs px-3 py-2 flex-1 transition-colors",
              activeCategory === category.id
                ? "text-green-500 border-b-2 border-green-500 dark:text-green-400 dark:border-green-400"
                : "text-gray-500 hover:text-green-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
            onClick={() => handleCategoryChange(category.id)}
          >
            <span className="mr-1.5">{category.icon}</span>
            {category.label}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center p-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="text-center py-8 px-4 text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p>No {activeCategory !== 'all' ? `${activeCategory} ` : ''}notifications yet</p>
            {activeCategory !== 'all' && (
              <button 
                onClick={() => setActiveCategory('all')}
                className="mt-2 text-green-500 hover:text-green-600 text-sm font-medium"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div>
            {recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={onClose}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
        <Button
          variant="outline"
          className="w-full text-green-500 hover:text-green-600 border-green-500 hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/10"
          onClick={handleViewAll}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
};
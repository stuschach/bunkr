// src/components/notifications/NotificationList.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Tabs } from '@/components/ui/Tabs';
import { Notification, NotificationType } from '@/types/notification';
import { cn } from '@/lib/utils/cn';

export const NotificationList: React.FC = () => {
  const { 
    notifications, 
    loading, 
    error, 
    markAllAsRead, 
    fetchNotifications,
    notificationPreferences,
    updateNotificationPreferences 
  } = useNotifications();
  
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [activeFilterId, setActiveFilterId] = useState<string>('all');
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>(notifications);
  const [isEmpty, setIsEmpty] = useState<boolean>(false);
  
  // Define tabs for read/unread filtering
  const tabs = [
    { id: 'all', label: 'All Notifications' },
    { id: 'unread', label: 'Unread' }
  ];
  
  // Define notification type filters
  const filters = [
    { id: 'all', label: 'All', icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
          clipRule="evenodd"
        />
      </svg>
    )},
    { id: 'social', label: 'Social', types: ['like', 'comment', 'follow', 'mention'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
        />
      </svg>
    )},
    { id: 'tee-times', label: 'Tee Times', types: ['tee-time-invite', 'tee-time-approved', 'tee-time-request', 'tee-time-cancelled'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    )},
    { id: 'rounds', label: 'Rounds', types: ['round-shared'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"
        />
        <path
          d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"
        />
        <path
          d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"
        />
      </svg>
    )},
    { id: 'tournaments', label: 'Tournaments', types: ['tournament-update'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
          clipRule="evenodd"
        />
      </svg>
    )},
    { id: 'handicap', label: 'Handicap', types: ['handicap-updated'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    )},
    { id: 'courses', label: 'Courses', types: ['course-review'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
        />
      </svg>
    )},
    { id: 'friends', label: 'Friends', types: ['friend-activity'], icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
        />
      </svg>
    )}
  ];
  
  // Filter notifications when tab or filter changes
  useEffect(() => {
    if (loading) return;
    
    let filtered = [...notifications];
    
    // Apply read/unread filtering
    if (activeTabId === 'unread') {
      filtered = filtered.filter(notification => !notification.isRead);
    }
    
    // Apply type filtering
    if (activeFilterId !== 'all') {
      const selectedFilter = filters.find(filter => filter.id === activeFilterId);
      if (selectedFilter && selectedFilter.types) {
        filtered = filtered.filter(notification => 
          selectedFilter.types?.includes(notification.type)
        );
      }
    }
    
    setFilteredNotifications(filtered);
    setIsEmpty(filtered.length === 0);
  }, [activeTabId, activeFilterId, notifications, loading]);
  
  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
  };
  
  // Handle filter change
  const handleFilterChange = (filterId: string) => {
    setActiveFilterId(filterId);
  };
  
  // Refresh notifications
  const handleRefresh = () => {
    fetchNotifications();
  };
  
  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };
  
  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    filteredNotifications.forEach(notification => {
      const date = new Date(notification.createdAt instanceof Date 
        ? notification.createdAt
        : new Date(notification.createdAt.seconds * 1000));
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey = date.toISOString().split('T')[0];
      let dateLabel = '';
      
      // Format as Today, Yesterday, or date
      if (date.toDateString() === today.toDateString()) {
        dateLabel = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          notifications: [],
          dateLabel
        };
      }
      
      groups[dateKey].notifications.push(notification);
    });
    
    return groups;
  }, [filteredNotifications]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <Tabs
          tabs={tabs.map(tab => ({
            id: tab.id,
            label: tab.label,
            content: <></>
          }))}
          defaultTab="all"
          onChange={handleTabChange}
          variant="underline"
          className="flex-1"
        />
        
        <div className="flex space-x-2">
          {activeTabId === 'all' && (
            <Button 
              variant="outline" 
              onClick={handleMarkAllAsRead}
              disabled={!notifications.some(n => !n.isRead)}
              className="text-sm"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
              Mark all as read
            </Button>
          )}
          <Button variant="outline" onClick={handleRefresh} className="text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filter by:</div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={cn(
                "flex items-center px-3 py-1.5 rounded-full text-sm transition-colors",
                activeFilterId === filter.id
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
              onClick={() => handleFilterChange(filter.id)}
            >
              <span className="mr-1.5">{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <LoadingSpinner size="lg" color="primary" label="Loading notifications..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-lg text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            Try Again
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
            No notifications found
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {activeTabId === 'unread'
              ? "You don't have any unread notifications."
              : activeFilterId !== 'all'
                ? `You don't have any ${filters.find(f => f.id === activeFilterId)?.label.toLowerCase()} notifications.`
                : "You don't have any notifications yet."}
          </p>
          
          {(activeTabId !== 'all' || activeFilterId !== 'all') && (
            <div className="mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setActiveTabId('all');
                  setActiveFilterId('all');
                }}
                className="text-green-500 border-green-500"
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by date */}
          {Object.entries(groupedNotifications).map(([dateKey, group]) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                {group.dateLabel}
              </h3>
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                {group.notifications.map((notification: Notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    showActions={true}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Notification Settings */}
      {notificationPreferences && (
        <div className="mt-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm p-4">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Notification Settings</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable notification sounds
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox"
                  id="sound-toggle"
                  checked={notificationPreferences.soundEnabled}
                  onChange={() => {
                    updateNotificationPreferences({
                      soundEnabled: !notificationPreferences.soundEnabled
                    });
                  }}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label 
                  htmlFor="sound-toggle" 
                  className={cn(
                    "toggle-label block overflow-hidden h-6 rounded-full cursor-pointer",
                    notificationPreferences.soundEnabled 
                      ? "bg-green-500" 
                      : "bg-gray-300 dark:bg-gray-700"
                  )}
                ></label>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable toast notifications
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox"
                  id="toast-toggle"
                  checked={notificationPreferences.toastEnabled}
                  onChange={() => {
                    updateNotificationPreferences({
                      toastEnabled: !notificationPreferences.toastEnabled
                    });
                  }}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label 
                  htmlFor="toast-toggle" 
                  className={cn(
                    "toggle-label block overflow-hidden h-6 rounded-full cursor-pointer",
                    notificationPreferences.toastEnabled 
                      ? "bg-green-500" 
                      : "bg-gray-300 dark:bg-gray-700"
                  )}
                ></label>
              </div>
            </div>
            
            {notificationPreferences.soundEnabled && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Notification Volume: {Math.round(notificationPreferences.soundVolume * 100)}%
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={notificationPreferences.soundVolume}
                  onChange={(e) => {
                    updateNotificationPreferences({
                      soundVolume: parseFloat(e.target.value)
                    });
                  }}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <h4 className="text-md font-medium mb-3 text-gray-900 dark:text-gray-100">Notification Type Settings</h4>
            
            <div className="space-y-3">
              {Object.entries(notificationPreferences.typePreferences || {}).map(([type, pref]) => (
                <div key={type} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </p>
                    
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input 
                        type="checkbox"
                        checked={pref.enabled}
                        onChange={() => {
                          const updatedPrefs = {...notificationPreferences};
                          if (updatedPrefs.typePreferences[type as NotificationType]) {
                            updatedPrefs.typePreferences[type as NotificationType]!.enabled = 
                              !updatedPrefs.typePreferences[type as NotificationType]!.enabled;
                            updateNotificationPreferences(updatedPrefs);
                          }
                        }}
                        className="form-checkbox h-4 w-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">Enable</span>
                    </label>
                    
                    <label className="flex items-center text-xs">
                      <input 
                        type="checkbox"
                        checked={pref.showToast}
                        onChange={() => {
                          const updatedPrefs = {...notificationPreferences};
                          if (updatedPrefs.typePreferences[type as NotificationType]) {
                            updatedPrefs.typePreferences[type as NotificationType]!.showToast = 
                              !updatedPrefs.typePreferences[type as NotificationType]!.showToast;
                            updateNotificationPreferences(updatedPrefs);
                          }
                        }}
                        className="form-checkbox h-4 w-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                        disabled={!pref.enabled}
                      />
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">Toast</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for toggle switches */}
      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #10B981;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #10B981;
        }
        .toggle-checkbox {
          right: 0;
          z-index: 1;
          border-color: #D1D5DB;
          transition: all 0.3s;
        }
        .toggle-label {
          transition: background-color 0.3s;
        }
      `}</style>
    </div>
  );
};
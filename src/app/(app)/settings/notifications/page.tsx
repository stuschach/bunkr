// src/app/(app)/settings/notifications/page.tsx
'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { NotificationType } from '@/types/notification';
import { cn } from '@/lib/utils/cn';
import { useRouter } from 'next/navigation';

// Map for converting notification types to human-readable labels
const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  'like': 'Likes on your posts',
  'comment': 'Comments on your posts',
  'follow': 'New followers',
  'mention': 'Mentions in posts or comments',
  'tee-time-invite': 'Tee time invitations',
  'tee-time-approved': 'Tee time request approvals',
  'tee-time-request': 'Tee time join requests',
  'tee-time-cancelled': 'Tee time cancellations',
  'round-shared': 'Shared scorecards',
  'message': 'New messages',
  'handicap-updated': 'Handicap updates',
  'tournament-update': 'Tournament updates',
  'friend-activity': 'Friend activity',
  'course-review': 'Course reviews'
};

// Group notification types into categories for better organization
const NOTIFICATION_CATEGORIES = [
  {
    id: 'social',
    label: 'Social Notifications',
    types: ['like', 'comment', 'follow', 'mention'] as NotificationType[]
  },
  {
    id: 'tee-times',
    label: 'Tee Time Notifications',
    types: ['tee-time-invite', 'tee-time-approved', 'tee-time-request', 'tee-time-cancelled'] as NotificationType[]
  },
  {
    id: 'golf',
    label: 'Golf Activity Notifications',
    types: ['round-shared', 'handicap-updated', 'tournament-update'] as NotificationType[]
  },
  {
    id: 'other',
    label: 'Other Notifications',
    types: ['message', 'friend-activity', 'course-review'] as NotificationType[]
  }
];

export default function NotificationSettingsPage() {
  const { notificationPreferences, updateNotificationPreferences } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const router = useRouter();
  
  // Handle saving all notification preferences
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await updateNotificationPreferences(notificationPreferences!);
      // Show success message or toast
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      // Show error message or toast
    } finally {
      setIsSaving(false);
    }
  };
  
  // Test notification sound
  const handleTestSound = () => {
    if (isTestPlaying) return;
    
    setIsTestPlaying(true);
    try {
      const audio = new Audio('/sounds/notification.mp3');
      if (notificationPreferences?.soundVolume) {
        audio.volume = notificationPreferences.soundVolume;
      }
      audio.play().catch(e => console.log('Audio play prevented by browser policy', e));
      setTimeout(() => setIsTestPlaying(false), 2000);
    } catch (err) {
      console.error('Error playing notification sound:', err);
      setIsTestPlaying(false);
    }
  };
  
  // Toggle global notification setting
  const toggleGlobalSetting = (key: 'soundEnabled') => {
    if (!notificationPreferences) return;
    
    updateNotificationPreferences({
      [key]: !notificationPreferences[key]
    });
  };
  
  // Toggle notification type setting
  const toggleTypeSetting = (type: NotificationType, key: 'enabled') => {
    if (!notificationPreferences) return;
    
    const updatedPrefs = {...notificationPreferences};
    if (updatedPrefs.typePreferences[type]) {
      updatedPrefs.typePreferences[type]![key] = !updatedPrefs.typePreferences[type]![key];
      updateNotificationPreferences(updatedPrefs);
    }
  };
  
  // Loading state if preferences aren't loaded yet
  if (!notificationPreferences) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[50vh]">
          <LoadingSpinner size="lg" color="primary" label="Loading preferences..." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Heading level={1} className="mb-2">Notification Settings</Heading>
          <Text className="text-gray-500 dark:text-gray-400">
            Customize how you receive notifications from Bunkr
          </Text>
        </div>
        
        {/* Global notification settings */}
        <Card className="mb-8 p-6">
          <Heading level={3} className="mb-4">General Settings</Heading>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <Text className="font-medium">Notification Sounds</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Play sounds when you receive notifications
                </Text>
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleTestSound}
                  disabled={!notificationPreferences.soundEnabled || isTestPlaying}
                >
                  {isTestPlaying ? 'Playing...' : 'Test Sound'}
                </Button>
                <div className="relative inline-block w-14 align-middle select-none">
                  <input 
                    type="checkbox"
                    id="sound-toggle"
                    checked={notificationPreferences.soundEnabled}
                    onChange={() => toggleGlobalSetting('soundEnabled')}
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
            </div>
            
            {notificationPreferences.soundEnabled && (
              <div>
                <Text className="font-medium mb-2">
                  Sound Volume: {Math.round(notificationPreferences.soundVolume * 100)}%
                </Text>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={notificationPreferences.soundVolume}
                  onChange={(e) => {
                    updateNotificationPreferences({
                      soundVolume: parseFloat(e.target.value)
                    });
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>
            )}
          </div>
        </Card>
        
        {/* Notification type settings */}
        {NOTIFICATION_CATEGORIES.map(category => (
          <Card key={category.id} className="mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <Heading level={3}>{category.label}</Heading>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {category.types.map(type => {
                const typePreference = notificationPreferences.typePreferences[type];
                if (!typePreference) return null;
                
                return (
                  <div key={type} className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <Text className="font-medium">{NOTIFICATION_TYPE_LABELS[type]}</Text>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <label className="inline-flex items-center">
                        <input 
                          type="checkbox"
                          checked={typePreference.enabled}
                          onChange={() => toggleTypeSetting(type, 'enabled')}
                          className="form-checkbox h-5 w-5 text-green-500 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        
        {/* Actions buttons */}
        <div className="flex justify-between mt-8">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          
          <Button 
            variant="primary"
            onClick={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      
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
}
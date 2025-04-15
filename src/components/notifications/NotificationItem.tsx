// src/components/notifications/NotificationItem.tsx
// Enhanced to display type-specific notifications

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/types/notification';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  showActions?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  showActions = false,
}) => {
  const { markAsRead, deleteNotification } = useNotifications();

  // Format the notification time
  const timeAgo = notification.createdAt
    ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
    : '';

  // Get the notification link based on type and entity
  const getNotificationLink = (): string => {
    switch (notification.entityType) {
      case 'post':
        return `/feed?post=${notification.entityId}`;
      case 'tee-time':
        return `/tee-times/${notification.entityId}`;
      case 'profile':
        return `/profile/${notification.actorId}`;
      case 'round':
        return `/scorecard/${notification.entityId}`;
      case 'comment':
        return `/feed?post=${notification.data?.postId || ''}&comment=${notification.entityId}`;
      case 'message':
        return `/messages/${notification.entityId}`;
      case 'tournament':
        return `/tournaments/${notification.entityId}`;
      case 'course':
        return `/courses/${notification.entityId}${notification.data?.reviewId ? `?review=${notification.data.reviewId}` : ''}`;
      default:
        return '/notifications';
    }
  };

  // Get the notification content based on type
  const getNotificationContent = (): { title: string; subtitle?: string; icon: React.ReactNode } => {
    const defaultAvatar = notification.actor?.photoURL || null;
    const name = notification.actor?.displayName || 'Someone';

    switch (notification.type) {
      case 'like':
        // Check for post type in the notification data
        const postType = notification.data?.postType || 'post';
        let likeTitle = `${name} liked your post`;
        
        // Customize based on post type
        if (postType === 'round') {
          likeTitle = `${name} liked your round post`;
        } else if (postType === 'tee-time') {
          likeTitle = `${name} liked your tee time post`;
        } else if (postType === 'photo') {
          likeTitle = `${name} liked your photo`;
        } else if (postType === 'video') {
          likeTitle = `${name} liked your video`;
        }
        
        return {
          title: likeTitle,
          subtitle: notification.data?.content,
          icon: (
            <div className="bg-red-100 dark:bg-red-800/30 text-red-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'comment':
        // Check for post type in the notification data
        const commentPostType = notification.data?.postType || 'post';
        let commentTitle = `${name} commented on your post`;
        
        // Customize based on post type
        if (commentPostType === 'round') {
          commentTitle = `${name} commented on your round post`;
        } else if (commentPostType === 'tee-time') {
          commentTitle = `${name} commented on your tee time post`;
        } else if (commentPostType === 'photo') {
          commentTitle = `${name} commented on your photo`;
        } else if (commentPostType === 'video') {
          commentTitle = `${name} commented on your video`;
        }
        
        return {
          title: commentTitle,
          subtitle: notification.data?.content,
          icon: (
            <div className="bg-blue-100 dark:bg-blue-800/30 text-blue-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'follow':
        return {
          title: `${name} started following you`,
          icon: (
            <div className="bg-green-100 dark:bg-green-800/30 text-green-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"
                />
              </svg>
            </div>
          ),
        };
      case 'tee-time-invite':
        return {
          title: `${name} invited you to join a tee time at ${
            notification.data?.courseName || 'a golf course'
          }`,
          subtitle: notification.data?.date ? `${new Date(notification.data.date).toLocaleDateString()}` : undefined,
          icon: (
            <div className="bg-purple-100 dark:bg-purple-800/30 text-purple-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'tee-time-approved':
        return {
          title: `${name} approved your request to join the tee time at ${
            notification.data?.courseName || 'a golf course'
          }`,
          subtitle: notification.data?.date ? `${new Date(notification.data.date).toLocaleDateString()}` : undefined,
          icon: (
            <div className="bg-green-100 dark:bg-green-800/30 text-green-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'tee-time-request':
        return {
          title: `${name} requested to join your tee time at ${
            notification.data?.courseName || 'your golf course'
          }`,
          subtitle: notification.data?.date ? `${new Date(notification.data.date).toLocaleDateString()}` : undefined,
          icon: (
            <div className="bg-yellow-100 dark:bg-yellow-800/30 text-yellow-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'tee-time-cancelled':
        return {
          title: `The tee time at ${
            notification.data?.courseName || 'a golf course'
          } has been cancelled`,
          subtitle: notification.data?.date ? `${new Date(notification.data.date).toLocaleDateString()}` : undefined,
          icon: (
            <div className="bg-red-100 dark:bg-red-800/30 text-red-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'round-shared':
        return {
          title: `${name} shared a round of ${notification.data?.score || ''}${
            notification.data?.score ? ' at ' : ''
          }${notification.data?.courseName || 'a golf course'}`,
          icon: (
            <div className="bg-blue-100 dark:bg-blue-800/30 text-blue-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            </div>
          ),
        };
      case 'mention':
        return {
          title: `${name} mentioned you in a ${notification.entityType === 'comment' ? 'comment' : 'post'}`,
          subtitle: notification.data?.content,
          icon: (
            <div className="bg-indigo-100 dark:bg-indigo-800/30 text-indigo-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'handicap-updated':
        return {
          title: `Your handicap has been updated to ${notification.data?.newHandicap}`,
          subtitle: notification.data?.previousHandicap 
            ? `Previous handicap: ${notification.data.previousHandicap}` 
            : undefined,
          icon: (
            <div className="bg-teal-100 dark:bg-teal-800/30 text-teal-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'tournament-update':
        return {
          title: notification.data?.content || `Update for tournament: ${notification.data?.tournamentName}`,
          subtitle: notification.data?.tournamentRound 
            ? `Round ${notification.data.tournamentRound}` 
            : undefined,
          icon: (
            <div className="bg-amber-100 dark:bg-amber-800/30 text-amber-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      case 'course-review':
        return {
          title: `${name} left a ${notification.data?.courseRating || ''}-star review on ${notification.data?.courseName || 'a course'}`,
          subtitle: notification.data?.content,
          icon: (
            <div className="bg-yellow-100 dark:bg-yellow-800/30 text-yellow-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>
            </div>
          ),
        };
      case 'friend-activity':
        const activityType = notification.data?.activityType || '';
        let activityTitle = `${name} `;
        
        if (activityType === 'round') {
          activityTitle += `completed a round at ${notification.data?.courseName || 'a golf course'}`;
        } else if (activityType === 'achievement') {
          activityTitle += `earned an achievement: ${notification.data?.achievementName || ''}`;
        } else if (activityType === 'milestone') {
          activityTitle += `reached a milestone: ${notification.data?.milestoneName || ''}`;
        } else {
          activityTitle += 'had some activity';
        }
        
        return {
          title: activityTitle,
          subtitle: notification.data?.content,
          icon: (
            <div className="bg-pink-100 dark:bg-pink-800/30 text-pink-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
      default:
        return {
          title: 'New notification',
          icon: (
            <div className="bg-gray-100 dark:bg-gray-800/30 text-gray-500 p-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ),
        };
    }
  };

  const { title, subtitle, icon } = getNotificationContent();
  const link = getNotificationLink();

  // Handle read click
  const handleMarkAsRead = async (e: React.MouseEvent) => {
    if (!notification.isRead) {
      e.stopPropagation();
      e.preventDefault();
      await markAsRead(notification.id);
      if (onClick) onClick();
      // Now navigate to the link
      window.location.href = link;
    }
  };

  // Handle delete click
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await deleteNotification(notification.id);
  };

  return (
    <Link
      href={link}
      onClick={handleMarkAsRead}
      className={cn(
        'flex items-start p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative',
        !notification.isRead ? 'bg-green-50 dark:bg-green-900/10' : 'bg-white dark:bg-gray-900',
        notification.priority === 'high' && !notification.isRead && 'border-l-4 border-green-500 dark:border-green-400 pl-3'
      )}
    >
      <div className="flex-shrink-0 mr-3">
        {notification.actor ? (
          <Avatar
            src={notification.actor.photoURL}
            alt={notification.actor.displayName || ''}
            size="md"
          />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-gray-900 dark:text-gray-100', 
          !notification.isRead && 'font-semibold')}>
          {title}
        </p>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{timeAgo}</p>
      </div>
      
      {showActions && (
        <div className="flex items-center ml-2">
          {!notification.isRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                markAsRead(notification.id);
              }}
              className="text-green-500 hover:text-green-600 p-1"
              title="Mark as read"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600 p-1"
            title="Delete notification"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
      
      {/* Priority indicator for high priority notifications */}
      {notification.priority === 'high' && !notification.isRead && (
        <div className="absolute top-2 right-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </Link>
  );
};
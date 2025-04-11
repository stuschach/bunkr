// src/components/notifications/NotificationBell.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { NotificationDropdown } from './NotificationDropdown';
import { cn } from '@/lib/utils/cn';

interface NotificationBellProps {
  className?: string;
  variant?: 'default' | 'mobile';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  className,
  variant = 'default'
}) => {
  const { unreadCount, hasNewNotifications, clearNewNotificationsFlag } = useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle animation when new notifications arrive
  useEffect(() => {
    if (hasNewNotifications && !isDropdownOpen) {
      setIsAnimating(true);
      
      // Clear any existing animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      // Stop animation after a few seconds
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 3000);
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [hasNewNotifications, isDropdownOpen]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    
    if (!isDropdownOpen) {
      // Clear the "new notifications" flag when opening the dropdown
      clearNewNotificationsFlag();
      setIsAnimating(false);
      
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    }
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  // Generate the animation class based on state
  const animationClass = isAnimating 
    ? 'animate-bell-ring' 
    : '';

  return (
    <div className="relative">
      <button
        ref={bellRef}
        className={cn(
          'relative p-2 rounded-full transition-colors',
          variant === 'default' 
            ? 'hover:bg-gray-100 dark:hover:bg-gray-800' 
            : 'flex flex-col items-center justify-center w-full h-full text-xs',
          isDropdownOpen 
            ? 'text-green-500 bg-green-50 dark:bg-green-900/10' 
            : 'text-gray-700 dark:text-gray-300',
          animationClass,
          className
        )}
        onClick={toggleDropdown}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {variant === 'default' ? (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            className={cn(
              "w-5 h-5",
              hasNewNotifications && !isDropdownOpen && "text-green-500"
            )}
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ) : (
          <>
            <div className="mb-1">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                className={cn(
                  "w-5 h-5",
                  hasNewNotifications && !isDropdownOpen && "text-green-500"
                )}
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <span className={cn(
              hasNewNotifications && !isDropdownOpen && "text-green-500"
            )}>Alerts</span>
          </>
        )}
        
        {/* Notification badge */}
        {unreadCount > 0 && (
          <span 
            className={cn(
              "absolute flex items-center justify-center text-xs font-bold text-white bg-green-500 rounded-full shadow-sm",
              variant === 'default'
                ? "top-0 right-0 h-5 w-5 transform translate-x-1/2 -translate-y-1/2"
                : "top-1 right-1/4 h-5 w-5"
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification dropdown */}
      <NotificationDropdown 
        isOpen={isDropdownOpen} 
        onClose={closeDropdown} 
      />
      
      {/* Add bell ring animation to styles */}
      <style jsx global>{`
        @keyframes bell-ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(10deg); }
          20% { transform: rotate(-10deg); }
          30% { transform: rotate(8deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-6deg); }
          70% { transform: rotate(4deg); }
          80% { transform: rotate(-4deg); }
          90% { transform: rotate(2deg); }
          100% { transform: rotate(0); }
        }
        
        .animate-bell-ring {
          animation: bell-ring 1s ease-in-out;
          animation-iteration-count: 2;
        }
      `}</style>
    </div>
  );
};
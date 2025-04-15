'use client';

import React, { useState, useEffect } from 'react';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { cn } from '@/lib/utils/cn';

interface MessageBadgeProps {
  className?: string;
  maxCount?: number;
}

/**
 * A badge that displays the total number of unread messages
 */
export function MessageBadge({ className, maxCount = 9 }: MessageBadgeProps) {
  const { unreadCounts } = useMessages();
  
  // Extract total unread count 
  const totalUnread = unreadCounts.totalUnread || 0;
  
  // If there are no unread messages, don't render anything
  if (totalUnread === 0) {
    return null;
  }

  // Format the count for display
  const displayCount = totalUnread > maxCount ? `${maxCount}+` : totalUnread.toString();

  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center h-5 w-5 text-xs font-medium text-white bg-green-500 rounded-full",
        className
      )}
      aria-label={`${totalUnread} unread messages`}
      title={`${totalUnread} unread messages`}
    >
      {displayCount}
    </span>
  );
}
import React from 'react';
import { cn } from '@/lib/utils/cn';
import { formatMessageTime } from '@/lib/utils/message-utils';
import { Message } from '@/types/messages';
import { DELETED_MESSAGE_TEXT } from '@/lib/constants';
import { safeTimestampToDate } from '@/lib/utils/timestamp-utils';

interface DeletedMessageProps {
  message: Message;
  isCurrentUser: boolean;
  className?: string;
}

/**
 * A dedicated component for rendering deleted messages with consistent styling
 */
export function DeletedMessage({ message, isCurrentUser, className }: DeletedMessageProps) {
  // Safely get the message timestamp
  const messageDate = safeTimestampToDate(message.createdAt);
  
  return (
    <div 
      className={cn(
        "p-3 rounded-lg",
        isCurrentUser 
          ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-tr-none" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-tl-none",
        className
      )}
    >
      <p className="italic text-sm">
        {DELETED_MESSAGE_TEXT}
      </p>
      
      <div className="mt-1 text-xs opacity-70 text-right">
        {messageDate ? formatMessageTime(messageDate) : ''}
      </div>
    </div>
  );
}
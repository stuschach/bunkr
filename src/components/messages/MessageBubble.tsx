// src/components/messages/MessageBubble.tsx
import React, { useState } from 'react';
import { Message } from '@/types/messages';
import { safeTimestampToDate } from '@/lib/utils/timestamp-utils';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  sender: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isCurrentUser, 
  sender, 
  showAvatar = true, 
  isFirstInGroup = true,
  isLastInGroup = true,
  onDelete
}) => {
  const [showOptions, setShowOptions] = useState(false);
  
  // Safe timestamp conversion
  const messageTime = safeTimestampToDate(message.createdAt) || new Date();
  
  // Message status - unread, delivered, etc.
  const isRead = message.readBy && Object.keys(message.readBy).length > 1;
  
  // Determine if this is a deleted message
  const isDeleted = message.deleted;
  
  // Helper function to format time
  const formatTime = (date: Date): string => {
    if (!date) return '';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };
  
  return (
    <div
      className={`flex items-start mb-2 ${isCurrentUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
    >
      {!isCurrentUser && showAvatar && isFirstInGroup && (
        <div className="mr-2 flex-shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              {sender?.photoURL ? (
                <img src={sender.photoURL} alt={sender.displayName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-green-600 flex items-center justify-center text-white font-medium">
                  {(sender?.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
          </div>
        </div>
      )}
      
      <div className={`max-w-[75%] group ${!isCurrentUser && !showAvatar && 'ml-10'}`}>
        {isFirstInGroup && !isCurrentUser && (
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">
            {sender?.displayName || 'User'}
          </div>
        )}
        
        <div 
          className={`relative ${isFirstInGroup ? '' : isCurrentUser ? 'mr-4' : 'ml-10'}`}
          onMouseEnter={() => setShowOptions(true)}
          onMouseLeave={() => setShowOptions(false)}
        >
          {isDeleted ? (
            <div className={`
              p-3 text-sm italic rounded-xl 
              ${isCurrentUser ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 
                'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
              ${!isFirstInGroup && isCurrentUser ? 'rounded-tr-md' : ''}
              ${!isFirstInGroup && !isCurrentUser ? 'rounded-tl-md' : ''}
              ${!isLastInGroup && isCurrentUser ? 'rounded-br-md' : ''}
              ${!isLastInGroup && !isCurrentUser ? 'rounded-bl-md' : ''}
            `}>
              This message has been deleted
            </div>
          ) : (
            <div className={`
              p-3 rounded-xl 
              ${isCurrentUser ? 
                'bg-gradient-to-br from-green-500 to-green-600 text-white' : 
                'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm'}
              ${!isFirstInGroup && isCurrentUser ? 'rounded-tr-md' : ''}
              ${!isFirstInGroup && !isCurrentUser ? 'rounded-tl-md' : ''}
              ${!isLastInGroup && isCurrentUser ? 'rounded-br-md' : ''}
              ${!isLastInGroup && !isCurrentUser ? 'rounded-bl-md' : ''}
            `}>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <div className="mt-1 text-xs opacity-70 text-right flex justify-end items-center space-x-1">
                <span>{formatTime(messageTime)}</span>
                {isCurrentUser && (
                  <span>
                    {isRead ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path d="M7.08,10.28a.75.75,0,0,0,0,1.06l3.18,3.18a.75.75,0,0,0,1.06,0l8.5-8.5a.75.75,0,0,0-1.06-1.06L11.25,12.44,8.14,9.33A.75.75,0,0,0,7.08,10.28Z"/>
                        <path d="M4.28,10.28a.75.75,0,0,0,0,1.06l3.18,3.18a.75.75,0,0,0,1.06,0,.75.75,0,0,1-1.06,0L4.28,11.34A.75.75,0,0,0,4.28,10.28Z"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path d="M9.97,13.97l7.5-7.5a.75.75,0,0,0-1.06-1.06L9.25,12.56,6.14,9.44a.75.75,0,0,0-1.06,1.06l3.75,3.75A.75.75,0,0,0,9.97,13.97Z"/>
                      </svg>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Message options - only shown for current user's messages */}
          {showOptions && isCurrentUser && !isDeleted && (
            <div 
              className="absolute top-0 right-full mr-2 bg-white dark:bg-gray-900 shadow-md rounded-full p-1 flex items-center space-x-1 animate-scaleIn"
            >
              <button 
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-red-500"
                onClick={() => onDelete && onDelete(message.id)}
                aria-label="Delete message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { Message, Chat } from '@/types/messages';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils/cn';
import { formatMessageTime, getOtherParticipant } from '@/lib/utils/message-utils';

interface MessageThreadProps {
  messages: Message[];
  chat: Chat;
  currentUserId: string;
  onDeleteMessage?: (messageId: string) => void;
  onMarkAsRead?: (messageIds: string[]) => void;
}

export function MessageThread({ 
  messages, 
  chat, 
  currentUserId, 
  onDeleteMessage,
  onMarkAsRead 
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  
  // Track which date dividers we've shown
  const [shownDates, setShownDates] = useState<Set<string>>(new Set());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when they become visible
  useEffect(() => {
    if (!onMarkAsRead || messages.length === 0) return;
    
    // Find unread messages not sent by current user
    const unreadMessageIds = messages
      .filter(msg => 
        msg.senderId !== currentUserId && 
        (!msg.readBy || !msg.readBy[currentUserId])
      )
      .map(msg => msg.id);
    
    if (unreadMessageIds.length > 0) {
      onMarkAsRead(unreadMessageIds);
    }
  }, [messages, currentUserId, onMarkAsRead]);

  // Helper to get participant info
  const getParticipantInfo = (userId: string) => {
    if (userId === currentUserId) {
      return null; // Current user
    }
    
    if (!chat.participantProfiles) return null;
    
    return chat.participantProfiles[userId];
  };

  // Handle message options menu
  const handleMessageOptions = (messageId: string) => {
    setSelectedMessage(selectedMessage === messageId ? null : messageId);
  };

  // Handle message deletion
  const handleDeleteMessage = (messageId: string) => {
    if (onDeleteMessage) {
      onDeleteMessage(messageId);
      setSelectedMessage(null);
    }
  };

  // Check if we should show a date divider before this message
  const shouldShowDateDivider = (message: Message, index: number) => {
    const messageDate = message.createdAt instanceof Date 
      ? message.createdAt 
      : message.createdAt.toDate();
    
    // Format date as YYYY-MM-DD for comparison
    const dateKey = format(messageDate, 'yyyy-MM-dd');
    
    // If we've already shown this date, don't show it again
    if (shownDates.has(dateKey)) return false;
    
    // If it's the first message, show date
    if (index === 0) {
      setShownDates(prev => new Set(prev).add(dateKey));
      return true;
    }
    
    // Check if the date is different from the previous message
    const prevMessage = messages[index - 1];
    const prevDate = prevMessage.createdAt instanceof Date 
      ? prevMessage.createdAt 
      : prevMessage.createdAt.toDate();
    
    if (!isSameDay(messageDate, prevDate)) {
      setShownDates(prev => new Set(prev).add(dateKey));
      return true;
    }
    
    return false;
  };

  // Format date for the divider
  const formatDateDivider = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else {
      return format(date, 'EEEE, MMMM d, yyyy');
    }
  };

  return (
    <div 
      ref={threadRef}
      className="flex flex-col h-full overflow-y-auto px-4 py-4"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isCurrentUser = message.senderId === currentUserId;
            const participant = getParticipantInfo(message.senderId);
            const showDateDivider = shouldShowDateDivider(message, index);
            const messageDate = message.createdAt instanceof Date 
              ? message.createdAt 
              : message.createdAt.toDate();
            
            return (
              <React.Fragment key={message.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-6">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400">
                      {formatDateDivider(messageDate)}
                    </div>
                  </div>
                )}
                
                <div 
                  className={cn(
                    "flex items-start group",
                    isCurrentUser ? "justify-end" : "justify-start"
                  )}
                >
                  {!isCurrentUser && (
                    <Avatar
                      src={participant?.photoURL}
                      alt={participant?.displayName || 'User'}
                      size="sm"
                      className="mr-2 flex-shrink-0 mt-1"
                    />
                  )}
                  
                  <div className={cn(
                    "relative max-w-[75%]",
                    isCurrentUser ? "order-1" : "order-2"
                  )}>
                    <div className={cn(
                      "p-3 rounded-lg",
                      isCurrentUser 
                        ? "bg-green-500 text-white rounded-tr-none" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                    )}>
                      {message.deleted ? (
                        <p className="italic text-gray-500 dark:text-gray-400 text-sm">
                          This message has been deleted
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      )}
                      
                      <div className="mt-1 text-xs opacity-70 text-right">
                        {formatMessageTime(message.createdAt)}
                      </div>
                    </div>
                    
                    {/* Message options (delete, etc.) */}
                    {isCurrentUser && !message.deleted && (
                      <div className="absolute top-0 right-0 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMessageOptions(message.id)}
                          className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        
                        {selectedMessage === message.id && (
                          <div className="absolute top-0 right-6 mt-0 bg-white dark:bg-gray-900 shadow-md rounded-md py-1 z-10">
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="block w-full text-left px-4 py-1 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
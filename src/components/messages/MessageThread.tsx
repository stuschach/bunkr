'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';
import { formatMessageDateDivider } from '@/lib/utils/message-utils';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { safeTimestampToDate } from '@/lib/utils/timestamp-utils';

// Import the MessageBubble component
const MessageBubble = ({ 
  message, 
  isCurrentUser, 
  sender, 
  showAvatar = true, 
  isFirstInGroup = true,
  isLastInGroup = true,
  onDelete = () => {},
}) => {
  const [showOptions, setShowOptions] = useState(false);
  
  // Safe timestamp conversion
  const messageTime = safeTimestampToDate(message.createdAt) || new Date();
  
  // Message status - unread, delivered, etc.
  const isRead = message.readBy && Object.keys(message.readBy).length > 1;
  
  // Determine if this is a deleted message
  const isDeleted = message.deleted;
  
  // Helper function to format time
  const formatTime = (date) => {
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
                onClick={() => onDelete(message.id)}
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

function MessageThread({ onScrollUpThreshold, className }: { 
  onScrollUpThreshold?: () => void, 
  className?: string 
}) {
  const { user } = useAuth();
  const { 
    messages, 
    selectedChat,
    isLoadingMessages, 
    error,
    hasMoreMessages,
    deleteMessage,
    markMessagesAsRead,
    loadMoreMessages
  } = useMessages();
  
  // Refs for scrolling
  const parentRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  
  // State for UI interactions
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Track which date dividers we've shown
  const [dateKeys, setDateKeys] = useState({});
  
  // Create a Map for quick lookup of shown date dividers
  const dateKeyMap = useMemo(() => {
    return new Map(Object.entries(dateKeys).map(([key, value]) => [key, value]));
  }, [dateKeys]);
  
  // Enhanced messages with date dividers
  const processedItems = useMemo(() => {
    if (!messages.length) return [];
    
    const items = [];
    const seenDates = new Set();
    
    // Process each message - working with messages in chronological order (oldest first)
    messages.forEach((message) => {
      // Safely get the message date with null checking
      const messageDate = safeTimestampToDate(message.createdAt) || new Date();
      const dateKey = messageDate.toDateString();
      
      // If we haven't shown this date yet
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        
        // Add a date divider
        items.push({
          isDateDivider: true,
          date: messageDate,
          key: `date-${dateKey}`
        });
      }
      
      // Add the message
      items.push(message);
    });
    
    return items;
  }, [messages]);
  
  // Group messages by sender for better UI presentation
  const groupedProcessedItems = useMemo(() => {
    return processedItems.map((item, index) => {
      // Skip date dividers
      if ('isDateDivider' in item) return item;
      
      const message = item;
      const prevItem = index > 0 ? processedItems[index - 1] : null;
      const nextItem = index < processedItems.length - 1 ? processedItems[index + 1] : null;
      
      // Check if previous item is a date divider or a message from another sender
      const isFirstInGroup = 
        !prevItem || 
        'isDateDivider' in prevItem || 
        prevItem.senderId !== message.senderId;
      
      // Check if next item is a date divider or a message from another sender
      const isLastInGroup = 
        !nextItem || 
        'isDateDivider' in nextItem || 
        nextItem.senderId !== message.senderId;
      
      return {
        ...message,
        isFirstInGroup,
        isLastInGroup
      };
    });
  }, [processedItems]);

  // Virtual list for performance - with Instagram-style bottom-up approach
  const virtualizer = useVirtualizer({
    count: groupedProcessedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated average height of a message
    overscan: 10,
  });
  
  // Scroll to bottom on initial load - fixed to ensure we start at the bottom
  useEffect(() => {
    if (!messages.length || !parentRef.current || !messagesEndRef.current) return;
    
    // Always scroll to bottom on initial load
    if (!initialScrollDoneRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      initialScrollDoneRef.current = true;
    } 
    // On new messages, scroll to bottom if we're already near the bottom
    else if (messages.length > lastMessageCountRef.current) {
      const container = parentRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    // Update the reference for message count
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);
  
  // Reset scroll state when switching chats
  useEffect(() => {
    initialScrollDoneRef.current = false;
    lastMessageCountRef.current = 0;
  }, [selectedChat?.id]);
  
  // Handle loading more messages when scrolling up
  const handleScroll = useCallback(async () => {
    if (!parentRef.current || isLoadingMoreRef.current || !hasMoreMessages) return;
    
    // Check if we're near the top - using a more sensitive threshold (100px from top)
    const { scrollTop } = parentRef.current;
    
    if (scrollTop < 100) {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
      
      try {
        // Record scroll position and height before loading more messages
        const scrollContainer = parentRef.current;
        const oldScrollHeight = scrollContainer.scrollHeight;
        const oldScrollTop = scrollContainer.scrollTop;
        
        // Load older messages
        await loadMoreMessages();
        
        // After messages load, keep the scroll position relative to the content
        // so the viewport doesn't jump
        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            scrollContainer.scrollTop = oldScrollTop + heightDifference;
          }
        }, 0);
      } finally {
        setIsLoadingMore(false);
        // Add a small delay before allowing another load
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 500);
      }
    }
  }, [hasMoreMessages, loadMoreMessages]);
  
  // Set up scroll listener
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    
    element.addEventListener('scroll', handleScroll);
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);
  
  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId);
  };
  
  // Fixed: Get participant info with improved logic for correct user display
  const getParticipantInfo = (userId) => {
    // First check if this is the current user
    if (userId === user?.uid) {
      return {
        uid: user.uid,
        displayName: user.displayName || "You",
        photoURL: user.photoURL,
        handicapIndex: user.handicapIndex || null
      };
    }
    
    // For other participants, get directly from selectedChat.participantProfiles
    if (selectedChat?.participantProfiles) {
      const otherUser = Object.values(selectedChat.participantProfiles).find(
        profile => profile.uid === userId
      );
      
      if (otherUser) {
        return otherUser;
      }
    }
    
    // If not found in participantProfiles, try directly from participantArray
    if (selectedChat?.participantArray?.includes(userId)) {
      // The user is a participant, but we don't have their profile
      // Try to find them in the chat participant data
      return {
        uid: userId,
        displayName: "User",
        photoURL: null,
        handicapIndex: null
      };
    }
    
    // Final fallback
    return {
      uid: userId,
      displayName: "Unknown User",
      photoURL: null,
      handicapIndex: null
    };
  };

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size="md" color="primary" label="Loading messages..." />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Try refreshing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={parentRef}
      className={cn("flex flex-col overflow-y-auto px-4 py-4", className)}
      style={{ height: '60vh', maxHeight: '60vh', overflow: 'auto' }}
    >
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <LoadingSpinner size="sm" color="primary" label="Loading more..." />
        </div>
      )}
      
      {hasMoreMessages && !isLoadingMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={() => {
              setIsLoadingMore(true);
              isLoadingMoreRef.current = true;
              loadMoreMessages().finally(() => {
                setIsLoadingMore(false);
                setTimeout(() => {
                  isLoadingMoreRef.current = false;
                }, 500);
              });
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Load older messages
          </button>
        </div>
      )}
      
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = groupedProcessedItems[virtualItem.index];
            
            if ('isDateDivider' in item) {
              // Render date divider
              return (
                <div
                  key={item.key}
                  className="flex justify-center my-4"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="bg-gray-200 dark:bg-gray-700 px-4 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">
                    {formatMessageDateDivider(item.date)}
                  </div>
                </div>
              );
            } else {
              // Regular message
              const message = item;
              const isCurrentUser = message.senderId === user?.uid;
              const participant = getParticipantInfo(message.senderId);
              
              return (
                <div
                  key={message.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <MessageBubble
                    message={message}
                    isCurrentUser={isCurrentUser}
                    sender={participant}
                    isFirstInGroup={message.isFirstInGroup}
                    isLastInGroup={message.isLastInGroup}
                    onDelete={handleDeleteMessage}
                  />
                </div>
              );
            }
          })}
        </div>
      )}
      
      {/* This is the bottom anchor for scrolling */}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageThread;
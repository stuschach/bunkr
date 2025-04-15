// src/components/messages/MessageThread.tsx - Instagram-Style Implementation
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';
import { formatMessageDateDivider } from '@/lib/utils/message-utils';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { safeTimestampToDate } from '@/lib/utils/timestamp-utils';
import { Message } from '@/types/messages';

// Types and interfaces
interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  sender: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
    handicapIndex?: number | null;
  };
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onDelete?: (messageId: string) => void;
}

interface DateDivider {
  isDateDivider: true;
  date: Date;
  key: string;
}

interface EnhancedMessage extends Message {
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

type ProcessedItem = EnhancedMessage | DateDivider;

function isDateDivider(item: ProcessedItem): item is DateDivider {
  return (item as DateDivider).isDateDivider === true;
}

function isMessage(item: ProcessedItem): item is EnhancedMessage {
  return (item as EnhancedMessage).senderId !== undefined;
}

// MessageBubble component implementation (unchanged)
const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isCurrentUser, 
  sender, 
  showAvatar = true, 
  isFirstInGroup = true,
  isLastInGroup = true,
  onDelete = () => {},
}) => {
  const [showOptions, setShowOptions] = useState(false);
  
  const messageTime = safeTimestampToDate(message.createdAt) || new Date();
  const isRead = message.readBy && Object.keys(message.readBy).length > 1;
  const isDeleted = message.deleted;
  
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
      
      <div className={`max-w-[75%] group ${!isCurrentUser && !showAvatar ? 'ml-10' : ''}`}>
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

interface MessageThreadProps {
  onScrollUpThreshold?: () => void;
  className?: string;
}

const MessageThread: React.FC<MessageThreadProps> = ({ onScrollUpThreshold, className }) => {
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
  const parentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef<boolean>(false);
  const initialRenderRef = useRef<boolean>(true);
  
  // State for UI interactions
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  
  // Extract chat ID for stable dependency in useEffect
  const chatId = useMemo(() => selectedChat?.id || null, [selectedChat]);
  
  // Process messages for display (without reversing - maintain chronological order)
  const processedItems = useMemo((): ProcessedItem[] => {
    if (!messages.length) return [];
    
    const items: ProcessedItem[] = [];
    const seenDates = new Set<string>();
    
    // Process messages in chronological order (oldest first)
    messages.forEach((message) => {
      const messageDate = safeTimestampToDate(message.createdAt) || new Date();
      const dateKey = messageDate.toDateString();
      
      // Add date divider if we haven't seen this date yet
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        items.push({
          isDateDivider: true,
          date: messageDate,
          key: `date-${dateKey}`
        });
      }
      
      // Add the message
      items.push(message as EnhancedMessage);
    });
    
    return items;
  }, [messages]);
  
  // Group messages by sender for better UI presentation
  const groupedProcessedItems = useMemo((): ProcessedItem[] => {
    return processedItems.map((item, index) => {
      // Skip date dividers
      if (isDateDivider(item)) return item;
      
      const message = item;
      const prevItem = index > 0 ? processedItems[index - 1] : null;
      const nextItem = index < processedItems.length - 1 ? processedItems[index + 1] : null;
      
      // Check if previous item is a date divider or a message from another sender
      const isFirstInGroup = 
        !prevItem || 
        isDateDivider(prevItem) || 
        (isMessage(prevItem) && prevItem.senderId !== message.senderId);
      
      // Check if next item is a date divider or a message from another sender
      const isLastInGroup = 
        !nextItem || 
        isDateDivider(nextItem) || 
        (isMessage(nextItem) && nextItem.senderId !== message.senderId);
      
      return {
        ...message,
        isFirstInGroup,
        isLastInGroup
      };
    });
  }, [processedItems]);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: groupedProcessedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });
  
  // Direct scroll to bottom without animation
  const scrollToBottomInstantly = useCallback(() => {
    if (!parentRef.current) return;
    parentRef.current.scrollTop = parentRef.current.scrollHeight;
  }, []);
  
  // Scroll to bottom on initial render and when chat changes
  useEffect(() => {
    if (chatId) {
      initialRenderRef.current = true;
    }
  }, [chatId]);
  
  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0 && parentRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        scrollToBottomInstantly();
        initialRenderRef.current = false;
      });
    }
  }, [messages, scrollToBottomInstantly]);
  
  // Handle loading more messages when scrolling up
  const handleScroll = useCallback(async () => {
    if (!parentRef.current || isLoadingMoreRef.current || !hasMoreMessages) return;
    
    // Check if we're near the top (100px threshold)
    const scrollTop = parentRef.current.scrollTop;
    
    if (scrollTop < 100) {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
      
      try {
        // Record scroll position and height before loading
        const scrollContainer = parentRef.current;
        if (!scrollContainer) return;
        
        const oldScrollHeight = scrollContainer.scrollHeight;
        const oldScrollTop = scrollContainer.scrollTop;
        
        // Load older messages
        await loadMoreMessages();
        
        // Preserve scroll position after loading
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            scrollContainer.scrollTop = oldScrollTop + heightDifference;
          }
        });
      } finally {
        setIsLoadingMore(false);
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
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (deleteMessage) {
      await deleteMessage(messageId);
    }
  }, [deleteMessage]);
  
  // IMPROVED: Get participant info with better access for accurate profile display
  const getParticipantInfo = useCallback((userId: string) => {
    // First check if this is the current user
    if (user && userId === user.uid) {
      return {
        uid: user.uid,
        displayName: user.displayName || "You",
        photoURL: user.photoURL,
        handicapIndex: (user as any).handicapIndex || null
      };
    }
    
    // For other participants, access by key directly first
    if (selectedChat?.participantProfiles) {
      // Try direct key access first - this is how the structure usually works
      if (selectedChat.participantProfiles[userId]) {
        return selectedChat.participantProfiles[userId];
      }
      
      // If not found by key, search by uid property
      const otherUser = Object.values(selectedChat.participantProfiles).find(
        profile => profile && profile.uid === userId
      );
      
      if (otherUser) {
        return otherUser;
      }
    }
    
    // Last resort fallback
    return {
      uid: userId,
      displayName: "User",
      photoURL: null,
      handicapIndex: null
    };
  }, [user, selectedChat]);

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

  // Instagram-style container with auto-scroll to bottom
  return (
    <div 
      ref={parentRef}
      className={cn("h-full overflow-y-auto px-4 py-4", className)}
      style={{ 
        height: '60vh', 
        maxHeight: '60vh',
        overflowY: 'auto',
        // This positions content at the bottom on initial load
        display: 'flex',
        flexDirection: 'column-reverse',
      }}
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        <div className="flex flex-col-reverse w-full">
          {/* Loading indicator at top (visually) - when scrolling up */}
          {isLoadingMore && (
            <div className="flex justify-center py-2 order-first mb-4">
              <LoadingSpinner size="sm" color="primary" label="Loading more..." />
            </div>
          )}
          
          {/* Load more button at top (visually) */}
          {hasMoreMessages && !isLoadingMore && (
            <div className="flex justify-center py-2 order-first mb-4">
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
          
          {/* Messages - visually appear from bottom to top */}
          <div style={{ position: 'relative' }}>
            {groupedProcessedItems.map((item, index) => {
              if (isDateDivider(item)) {
                // Render date divider
                return (
                  <div key={item.key} className="flex justify-center my-4">
                    <div className="bg-gray-200 dark:bg-gray-700 px-4 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">
                      {formatMessageDateDivider(item.date)}
                    </div>
                  </div>
                );
              } else if (isMessage(item)) {
                // Regular message
                const message = item;
                const isCurrentUser = user ? message.senderId === user.uid : false;
                const participant = getParticipantInfo(message.senderId);
                
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isCurrentUser={isCurrentUser}
                    sender={participant}
                    isFirstInGroup={message.isFirstInGroup}
                    isLastInGroup={message.isLastInGroup}
                    onDelete={handleDeleteMessage}
                  />
                );
              }
              
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageThread;
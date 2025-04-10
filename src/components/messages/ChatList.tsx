'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Chat } from '@/types/messages';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';
import { 
  getChatName, 
  getChatAvatar, 
  formatChatListTime, 
  isLastMessageFromCurrentUser,
  truncateMessage
} from '@/lib/utils/message-utils';

interface ChatListProps {
  chats: Chat[];
  onChatSelect: (chatId: string) => void;
  selectedChatId?: string;
  currentUserId?: string;
  unreadCounts?: Record<string, number>;
}

export function ChatList({ 
  chats, 
  onChatSelect, 
  selectedChatId, 
  currentUserId,
  unreadCounts = {}
}: ChatListProps) {
  const router = useRouter();

  // Sort chats by recency (most recent first)
  const sortedChats = [...chats].sort((a, b) => {
    // FIX: Safe access to timestamps
    const aTime = a.updatedAt 
      ? (a.updatedAt instanceof Date 
          ? a.updatedAt 
          : a.updatedAt.toDate?.() || new Date()).getTime() 
      : 0;
    
    const bTime = b.updatedAt 
      ? (b.updatedAt instanceof Date 
          ? b.updatedAt 
          : b.updatedAt.toDate?.() || new Date()).getTime() 
      : 0;
    
    return bTime - aTime;
  });

  return (
    <div className="overflow-y-auto h-full">
      {sortedChats.length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Start chatting with other golfers to see them here
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {sortedChats.map(chat => (
            <li 
              key={chat.id}
              onClick={() => onChatSelect(chat.id)}
              className={cn(
                "px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors",
                selectedChatId === chat.id && "bg-gray-100 dark:bg-gray-800",
                unreadCounts[chat.id] && "bg-green-50 dark:bg-green-900/10"
              )}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar
                    src={currentUserId ? getChatAvatar(chat, currentUserId) : null}
                    alt={currentUserId ? getChatName(chat, currentUserId) : 'Chat'}
                    size="md"
                  />
                  {unreadCounts[chat.id] > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                      {unreadCounts[chat.id] > 9 ? '9+' : unreadCounts[chat.id]}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={cn(
                      "text-sm font-medium truncate",
                      unreadCounts[chat.id] > 0 && "font-semibold text-gray-900 dark:text-gray-100"
                    )}>
                      {currentUserId ? getChatName(chat, currentUserId) : 'Loading...'}
                    </h3>
                    {chat.lastMessage?.createdAt && (
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {formatChatListTime(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  
                  {chat.lastMessage && (
                    <div className="flex justify-between items-center mt-1">
                      <p className={cn(
                        "text-sm truncate max-w-[200px]",
                        unreadCounts[chat.id] > 0 
                          ? "text-gray-800 dark:text-gray-200" 
                          : "text-gray-500 dark:text-gray-400"
                      )}>
                        {currentUserId && isLastMessageFromCurrentUser(chat, currentUserId) && (
                          <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">You:</span>
                        )}
                        {truncateMessage(chat.lastMessage.content, 30)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
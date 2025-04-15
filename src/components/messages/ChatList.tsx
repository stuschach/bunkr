import React, { useState } from 'react';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { formatMessageTime } from '@/lib/utils/message-utils';
import { safeTimestampToDate } from '@/lib/utils/timestamp-utils';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

const ChatList = ({ onChatSelect }) => {
  const { user } = useAuth();
  const { 
    chats, 
    selectedChatId, 
    isLoadingChats, 
    error,
    unreadCounts
  } = useMessages();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter chats based on search query
  const filteredChats = chats.filter(chat => {
    const otherParticipant = !chat.isGroupChat && chat.participantProfiles ? 
      Object.values(chat.participantProfiles).find(profile => profile.uid !== user?.uid) : null;
    
    const displayName = chat.isGroupChat ? 
      (chat.title || 'Group Chat') : 
      (otherParticipant?.displayName || 'User');
    
    const lastMessageContent = chat.lastMessage?.content || '';
    
    return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           lastMessageContent.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  // Format time helper using the safe timestamp conversion
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = safeTimestampToDate(timestamp);
    if (!date) return '';
    
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      // Today - show time
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${formattedHours}:${formattedMinutes} ${ampm}`;
    } else if (diffInHours < 48) {
      // Yesterday
      return 'Yesterday';
    } else {
      // Older - show date
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    }
  };
  
  // Handle chat selection
  const handleChatClick = (chatId) => {
    if (onChatSelect) {
      onChatSelect(chatId);
    }
  };
  
  if (isLoadingChats && chats.length === 0) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <LoadingSpinner size="md" color="primary" label="Loading chats..." />
      </div>
    );
  }
  
  if (error && chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-red-500 dark:text-red-400 text-center">
          <p className="mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-sm underline"
          >
            Try refreshing
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Messages</h2>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full py-2 pl-9 pr-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-green-500 focus:border-green-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No conversations found' : (chats.length === 0 ? 'No conversations yet' : 'No matching conversations')}
            </p>
            <button 
              className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              onClick={() => onChatSelect && onChatSelect(null)}
            >
              Start a new conversation
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredChats.map(chat => {
              // Get other participant for direct chats
              const otherParticipant = !chat.isGroupChat && chat.participantProfiles ? 
                Object.values(chat.participantProfiles).find(profile => profile.uid !== user?.uid) : null;
                
              // Determine display name
              const displayName = chat.isGroupChat ? 
                (chat.title || 'Group Chat') : 
                (otherParticipant?.displayName || 'User');
                
              // Get unread count for this chat
              const unreadCount = unreadCounts.unreadByChat[chat.id] || 0;
              
              return (
                <li 
                  key={chat.id}
                  className={`
                    relative p-4 cursor-pointer transition-all
                    ${selectedChatId === chat.id ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}
                  `}
                  onClick={() => handleChatClick(chat.id)}
                >
                  <div className="flex items-start">
                    {/* Avatar */}
                    <div className="relative mr-3 flex-shrink-0">
                      <div className="relative">
                        {chat.isGroupChat ? (
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center text-green-700 dark:text-green-200 font-medium">
                            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                            {otherParticipant?.photoURL ? (
                              <img src={otherParticipant.photoURL} alt={displayName} className="w-12 h-12 object-cover" />
                            ) : (
                              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Unread count badge */}
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Chat info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <h3 className={`text-sm font-semibold truncate ${unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {displayName}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : formatTime(chat.updatedAt)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${unreadCount > 0 ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        {chat.lastMessage ? 
                          (chat.lastMessage.senderId === user?.uid ? 'You: ' : '') + chat.lastMessage.content 
                          : 'No messages yet'}
                      </p>
                    </div>
                  </div>

                  {/* Active chat indicator */}
                  {selectedChatId === chat.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      {/* Quick actions */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <button 
          className="w-full flex items-center justify-center space-x-2 p-2.5 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg transition-colors"
          onClick={() => onChatSelect && onChatSelect(null)}
        >
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="font-medium">New Message</span>
        </button>
      </div>
    </div>
  );
};

export default ChatList;
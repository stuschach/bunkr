'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMessages } from '@/lib/hooks/useMessages';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { ChatList } from '@/components/messages/ChatList';
import { MessageThread } from '@/components/messages/MessageThread';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { EmptyMessageState } from '@/components/messages/EmptyMessageState';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';
import { Message, Chat } from '@/types/messages';
import { getChatName, getOtherParticipant } from '@/lib/utils/message-utils';
import { useStore } from '@/store';

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();
  const { 
    chats, 
    isLoading, 
    error, 
    sendMessage, 
    getMessages,
    getOrCreateChat,
    searchUsers,
    deleteMessage,
    subscribeToMessages,
    markMessagesAsRead,
    getChatById
  } = useMessages();
  
  // Get the unread message count setter from the store
  const setUnreadMessageCount = useStore(state => state.setUnreadMessageCount);
  
  // State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allChatMessages, setAllChatMessages] = useState<Record<string, Message[]>>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  
  // Check for chat ID in URL parameters
  useEffect(() => {
    const chatId = searchParams.get('chat');
    if (chatId) {
      setSelectedChatId(chatId);
    }
  }, [searchParams]);
  
  // Calculate unread counts for each chat
  const unreadCounts = useMemo(() => {
    if (!user) return {};
    
    const counts: Record<string, number> = {};
    
    // Check all messages in each chat
    Object.entries(allChatMessages).forEach(([chatId, msgs]) => {
      counts[chatId] = msgs.filter(msg => 
        msg.senderId !== user.uid && 
        (!msg.readBy || !msg.readBy[user.uid])
      ).length;
    });
    
    return counts;
  }, [allChatMessages, user]);
  
  // Calculate total unread messages and update both page title and global store
  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);
  
  // Update page title and global unread count
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Messages - Bunkr`;
    } else {
      document.title = 'Messages - Bunkr';
    }
    
    // Update the global store with the latest count for navigation components
    setUnreadMessageCount(totalUnread);
    
    return () => {
      document.title = 'Bunkr - Golf Social Platform';
    };
  }, [totalUnread, setUnreadMessageCount]);
  
  // Load messages for all chats to get unread counts
  useEffect(() => {
    if (!user || chats.length === 0) return;
    
    const loadAllChatMessages = async () => {
      const messagesByChat: Record<string, Message[]> = {};
      
      // Load the first few messages from each chat
      await Promise.all(chats.map(async (chat) => {
        try {
          const msgs = await getMessages(chat.id, 20); // Limit to 20 most recent messages
          messagesByChat[chat.id] = msgs;
        } catch (error) {
          console.error(`Error loading messages for chat ${chat.id}:`, error);
        }
      }));
      
      setAllChatMessages(messagesByChat);
    };
    
    loadAllChatMessages();
  }, [chats, user, getMessages]);
  
  // Load selected chat data
  useEffect(() => {
    if (!selectedChatId || !user) return;
    
    const loadChat = async () => {
      setIsLoadingMessages(true);
      
      try {
        // First try to find the chat in the local list for efficiency
        const chatFromList = chats.find(c => c.id === selectedChatId);
        
        if (chatFromList) {
          setSelectedChat(chatFromList);
          
          // Load messages
          const chatMessages = await getMessages(selectedChatId);
          setMessages(chatMessages);
          
          // Subscribe to new messages
          const unsubscribe = subscribeToMessages(selectedChatId, (updatedMessages) => {
            setMessages(updatedMessages);
            // Also update the messages in allChatMessages
            setAllChatMessages(prev => ({
              ...prev,
              [selectedChatId]: updatedMessages
            }));
          });
          
          return unsubscribe;
        } else {
          // If not found in the list, fetch directly from the database
          const chatData = await getChatById(selectedChatId);
          
          if (chatData) {
            setSelectedChat(chatData);
            
            // Load messages
            const chatMessages = await getMessages(chatData.id);
            setMessages(chatMessages);
            
            // Subscribe to new messages
            const unsubscribe = subscribeToMessages(chatData.id, (updatedMessages) => {
              setMessages(updatedMessages);
              // Also update the messages in allChatMessages
              setAllChatMessages(prev => ({
                ...prev,
                [chatData.id]: updatedMessages
              }));
            });
            
            return unsubscribe;
          } else {
            // Chat not found - redirect back to main messages page
            console.error('Chat not found');
            setSelectedChatId(null);
            router.push('/messages');
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setSelectedChatId(null);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    
    const unsubscribePromise = loadChat();
    
    // Clean up subscription
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, [selectedChatId, chats, user, getMessages, subscribeToMessages, getChatById, router]);
  
  // Handle chat selection
  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    // Update URL to include the chat ID
    router.push(`/messages?chat=${chatId}`);
  };
  
  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!selectedChatId || !user || isSendingMessage) return;
    
    setIsSendingMessage(true);
    
    try {
      await sendMessage(selectedChatId, content);
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show an error toast here
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Handle deleting a message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChatId || !user) return;
    
    try {
      await deleteMessage(selectedChatId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      // Could show an error toast here
    }
  };
  
  // Handle marking messages as read
  const handleMarkAsRead = async (messageIds: string[]) => {
    if (!selectedChatId || !user || messageIds.length === 0) return;
    
    try {
      await markMessagesAsRead(selectedChatId, messageIds);
      
      // Update local message state to reflect read status
      setMessages(prevMessages => prevMessages.map(msg => {
        if (messageIds.includes(msg.id)) {
          return {
            ...msg,
            readBy: { ...msg.readBy, [user.uid]: true }
          };
        }
        return msg;
      }));
      
      // Also update the messages in allChatMessages
      setAllChatMessages(prev => {
        const updatedMessages = prev[selectedChatId]?.map(msg => {
          if (messageIds.includes(msg.id)) {
            return {
              ...msg,
              readBy: { ...msg.readBy, [user.uid]: true }
            };
          }
          return msg;
        }) || [];
        
        return {
          ...prev,
          [selectedChatId]: updatedMessages
        };
      });
      
      // Force a recalculation of unread counts in the next render cycle
      // This triggers the useEffect that updates the global unread message count
      setTimeout(() => {
        setAllChatMessages(prev => ({ ...prev }));
      }, 0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // Handle selecting a user to message
  const handleSelectUser = async (userId: string) => {
    if (!user) return;
    
    try {
      const chat = await getOrCreateChat(userId);
      handleChatSelect(chat.id);
    } catch (error) {
      console.error('Error creating chat:', error);
      // Could show an error toast here
    }
  };
  
  // Check if user is authenticated
  if (userLoading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }
  
  if (!user) {
    router.push('/login?returnUrl=/messages');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Heading level={2}>Messages</Heading>
          {totalUnread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {totalUnread} unread
            </span>
          )}
        </div>
        
        <Button onClick={() => setShowNewMessageDialog(true)}>
          New Message
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 min-h-[70vh]">
        {/* Chat list */}
        <div className="md:col-span-1">
          <Card className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold">Conversations</h3>
            </div>
            
            {isLoading ? (
              <div className="flex-1 flex justify-center items-center p-8">
                <LoadingSpinner size="md" color="primary" label="Loading chats..." />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ChatList 
                  chats={chats}
                  onChatSelect={handleChatSelect}
                  selectedChatId={selectedChatId || undefined}
                  currentUserId={user.uid}
                  unreadCounts={unreadCounts}
                />
              </div>
            )}
          </Card>
        </div>
        
        {/* Messages */}
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="h-full flex flex-col">
            {selectedChatId && selectedChat ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      className="md:hidden mr-2 p-2"
                      onClick={() => setSelectedChatId(null)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    
                    <h3 className="font-semibold">
                      {user && getChatName(selectedChat, user.uid)}
                    </h3>
                  </div>
                  
                  {/* User info button - could expand to show profile */}
                  {!selectedChat.isGroupChat && user && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        const otherParticipant = getOtherParticipant(selectedChat, user.uid);
                        if (otherParticipant) {
                          router.push(`/profile/${otherParticipant.uid}`);
                        }
                      }}
                    >
                      View Profile
                    </Button>
                  )}
                </div>
                
                {/* Message thread */}
                <div className="flex-1 overflow-hidden">
                  {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <LoadingSpinner size="md" color="primary" label="Loading messages..." />
                    </div>
                  ) : (
                    <MessageThread 
                      messages={messages}
                      chat={selectedChat}
                      currentUserId={user.uid}
                      onDeleteMessage={handleDeleteMessage}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  )}
                </div>
                
                {/* Message composer */}
                <MessageComposer 
                  onSendMessage={handleSendMessage}
                  isSending={isSendingMessage}
                />
              </>
            ) : (
              <EmptyMessageState 
                onNewChat={() => setShowNewMessageDialog(true)} 
              />
            )}
          </Card>
        </div>
      </div>
      
      {/* New message dialog */}
      <NewMessageDialog 
        open={showNewMessageDialog}
        onClose={() => setShowNewMessageDialog(false)}
        onSelectUser={handleSelectUser}
        onSearchUsers={searchUsers}
      />
    </div>
  );
}
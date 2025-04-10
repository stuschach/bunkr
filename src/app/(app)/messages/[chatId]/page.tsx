'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMessages } from '@/lib/hooks/useMessages';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { MessageThread } from '@/components/messages/MessageThread';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { Message, Chat } from '@/types/messages';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: userLoading } = useAuth();
  const { 
    chats, 
    isLoading, 
    error, 
    sendMessage, 
    getMessages,
    getOrCreateChat,
    deleteMessage,
    subscribeToMessages
  } = useMessages();
  
  // State
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Get the chat ID from the URL
  const chatId = params.chatId as string;
  
  // Load chat data
  useEffect(() => {
    if (!chatId || !user) return;
    
    const loadChat = async () => {
      setIsLoadingMessages(true);
      
      try {
        // Find the chat in the list
        const existingChat = chats.find(c => c.id === chatId);
        
        if (existingChat) {
          setChat(existingChat);
          
          // Load messages
          const chatMessages = await getMessages(chatId);
          setMessages(chatMessages);
          
          // Subscribe to new messages
          const unsubscribe = subscribeToMessages(chatId, (updatedMessages) => {
            setMessages(updatedMessages);
          });
          
          return unsubscribe;
        } else {
          // If not found, try to load it directly
          try {
            // In a real app with proper database structure, 
            // you would have an API to get a chat by ID
            // For this demo, we'll assume the chatId could be a userId
            // and try to create a new chat
            const otherUserId = chatId;
            
            const chatData = await getOrCreateChat(otherUserId);
            setChat(chatData);
            
            // Load messages
            const chatMessages = await getMessages(chatData.id);
            setMessages(chatMessages);
            
            // Subscribe to new messages
            const unsubscribe = subscribeToMessages(chatData.id, (updatedMessages) => {
              setMessages(updatedMessages);
            });
            
            return unsubscribe;
          } catch (error) {
            console.error('Error loading chat:', error);
            router.push('/messages');
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
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
  }, [chatId, chats, user, getMessages, subscribeToMessages, getOrCreateChat, router]);
  
  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!chatId || !user || isSendingMessage) return;
    
    setIsSendingMessage(true);
    
    try {
      await sendMessage(chatId, content);
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show an error toast here
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Handle deleting a message
  const handleDeleteMessage = async (messageId: string) => {
    if (!chatId || !user) return;
    
    try {
      await deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      // Could show an error toast here
    }
  };
  
  // Helper to get the other participant's info
  const getOtherParticipant = () => {
    if (!user || !chat || !chat.participantProfiles) return null;
    
    // Get the first participant who is not the current user
    const otherUserId = Object.keys(chat.participants).find(id => id !== user.uid);
    
    if (!otherUserId) return null;
    
    return chat.participantProfiles[otherUserId];
  };
  
  // Get chat name (either group name or other participant's name)
  const getChatName = () => {
    if (!chat) return 'Loading...';
    
    if (chat.isGroupChat && chat.title) {
      return chat.title;
    }
    
    const otherParticipant = getOtherParticipant();
    return otherParticipant?.displayName || 'Unknown User';
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
    router.push(`/login?returnUrl=/messages/${chatId}`);
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/messages')}
          className="flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Messages
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      <Card className="min-h-[70vh] flex flex-col">
        {/* Chat header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
          {chat && (
            <>
              {chat.isGroupChat ? (
                <div className="bg-green-100 dark:bg-green-900/30 h-10 w-10 rounded-full flex items-center justify-center text-green-500 font-bold mr-3">
                  {chat.title?.substring(0, 2) || 'G'}
                </div>
              ) : (
                <Avatar
                  src={getOtherParticipant()?.photoURL}
                  alt={getChatName()}
                  size="md"
                  className="mr-3"
                />
              )}
              <div>
                <h3 className="font-semibold">{getChatName()}</h3>
                {!chat.isGroupChat && getOtherParticipant()?.handicapIndex !== null && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Handicap: {getOtherParticipant()?.handicapIndex}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Message thread */}
        <div className="flex-1 overflow-hidden">
          {isLoading || isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner size="md" color="primary" label="Loading messages..." />
            </div>
          ) : chat ? (
            <MessageThread 
              messages={messages}
              chat={chat}
              currentUserId={user.uid}
              onDeleteMessage={handleDeleteMessage}
            />
          ) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500 dark:text-gray-400">Conversation not found</p>
            </div>
          )}
        </div>
        
        {/* Message composer */}
        {chat && (
          <MessageComposer 
            onSendMessage={handleSendMessage}
            isSending={isSendingMessage}
          />
        )}
      </Card>
    </div>
  );
}
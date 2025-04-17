'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { MessagesProvider, useMessages } from '@/lib/contexts/MessagesContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import ChatList from '@/components/messages/ChatList';
import MessageThread from '@/components/messages/MessageThread';
import MessageComposer from '@/components/messages/MessageComposer';
import { EmptyMessageState } from '@/components/messages/EmptyMessageState';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';

// Inner component that uses MessagesContext
function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();
  const { 
    chats, 
    selectChat,
    selectedChatId,
    selectedChat,
    messages, 
    unreadCounts, 
    isLoadingChats,
    isLoadingMessages,
    error,
    setError
  } = useMessages();
  
  // State for new message dialog
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  
  // Ref to track initial URL load to prevent loops
  const initialUrlLoadRef = useRef(true);
  
  // Check for chat ID in URL parameters - only on initial load
  useEffect(() => {
    const chatId = searchParams.get('chat');
    
    // Only process URL params on initial load or if we haven't selected a chat yet
    if (initialUrlLoadRef.current && chatId) {
      selectChat(chatId).catch(err => {
        console.error("Error loading chat from URL:", err);
      });
      initialUrlLoadRef.current = false;
    }
  }, [searchParams, selectChat]);
  
  // Update document title with unread count
  useEffect(() => {
    if (unreadCounts.totalUnread > 0) {
      document.title = `(${unreadCounts.totalUnread}) Messages - Bunkr`;
    } else {
      document.title = 'Messages - Bunkr';
    }
    
    return () => {
      document.title = 'Bunkr - Golf Social Platform';
    };
  }, [unreadCounts.totalUnread]);
  
  // Handle chat selection with protection against redundant updates
  const handleChatSelect = (chatId: string | null) => {
    // Only update if we're selecting a different chat
    if (selectedChatId !== chatId) {
      // Clear any existing errors
      if (error) setError(null);
      
      if (chatId !== null) {
        selectChat(chatId)
          .catch(err => {
            console.error("Error selecting chat:", err);
            // The error will be handled in the context
          })
          .finally(() => {
            // Update URL without full page reload
            if (chatId) {
              router.push(`/messages?chat=${chatId}`, { scroll: false });
            } else {
              router.push('/messages', { scroll: false });
            }
          });
      }
    }
  };
  
  // If still loading auth, show loading spinner
  if (userLoading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }
  
  // If not authenticated, redirect to login
  if (!user) {
    router.push('/login?returnUrl=/messages');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Heading level={2}>Messages</Heading>
          {unreadCounts.totalUnread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {unreadCounts.totalUnread} unread
            </span>
          )}
        </div>
        
        <Button onClick={() => setShowNewMessageDialog(true)}>
          New Message
        </Button>
      </div>
      
      {error && !selectedChatId && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 min-h-[70vh]">
        {/* Chat list */}
        <div className="md:col-span-1">
          <Card className="h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold">Conversations</h3>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <ChatList 
                onChatSelect={handleChatSelect}
              />
            </div>
          </Card>
        </div>
        
        {/* Messages */}
        <div className="md:col-span-2 lg:col-span-3">
          <Card className="h-[80vh] flex flex-col">
            {selectedChatId && selectedChat ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      className="md:hidden mr-2 p-2"
                      onClick={() => selectChat(null)}
                      aria-label="Back to chat list"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    
                    {!selectedChat.isGroupChat && (
                      <div className="mr-3 flex-shrink-0">
                        {/* Profile Picture - fixed to always show the other participant correctly */}
                        {(() => {
                          const otherParticipant = selectedChat.participantProfiles ? 
                            Object.values(selectedChat.participantProfiles)[0] : null;
                            
                          return (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                              {otherParticipant?.photoURL ? (
                                <img src={otherParticipant.photoURL} alt={otherParticipant.displayName || 'User'} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                  {otherParticipant?.displayName ? otherParticipant.displayName.charAt(0).toUpperCase() : 'U'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <h3 className="font-semibold">
                      {selectedChat?.isGroupChat 
                        ? (selectedChat.title || 'Group Chat') 
                        : selectedChat?.participantProfiles 
                          ? Object.values(selectedChat.participantProfiles)[0]?.displayName || 'User'
                          : 'User'
                      }
                    </h3>
                  </div>
                  
                  {/* User info button - could expand to show profile */}
                  {!selectedChat.isGroupChat && user && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        // Find other participant ID
                        const otherUserId = selectedChat.participantArray.find(id => id !== user.uid);
                        if (otherUserId) {
                          router.push(`/profile/${otherUserId}`);
                        }
                      }}
                      aria-label="View profile"
                    >
                      View Profile
                    </Button>
                  )}
                </div>
                
                {/* Message thread - with fixed height */}
                <div className="flex-1 overflow-hidden" style={{ height: '60vh', maxHeight: '60vh' }}>
                  <MessageThread />
                </div>
                
                {/* Message composer */}
                <MessageComposer />
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
      />
    </div>
  );
}

// Wrapper component that provides MessagesContext
export default function MessagesPage() {
  return (
    <MessagesProvider>
      <MessagesContent />
    </MessagesProvider>
  );
}
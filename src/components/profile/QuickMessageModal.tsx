// src/components/profile/QuickMessageModal.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useMessages } from '@/lib/hooks/useMessages';
import { useNotification } from '@/lib/contexts/NotificationContext';

interface QuickMessageModalProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

export function QuickMessageModal({
  recipientId,
  recipientName,
  onClose
}: QuickMessageModalProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { getOrCreateChat, sendMessage } = useMessages();
  const { showNotification } = useNotification();
  
  // Predefined quick messages for golf context
  const quickMessages = [
    "Want to play a round this weekend?",
    "I saw your scorecard. Nice round!",
    "What course do you recommend in this area?",
    "Would you be interested in joining our golf group?",
    "What clubs are you using these days?"
  ];

  const handleSelectQuickMessage = (text: string) => {
    setMessage(text);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Authentication Required',
        description: 'You must be logged in to send messages.'
      });
      return;
    }

    setIsSending(true);
    
    try {
      // First create or get the existing chat
      const chat = await getOrCreateChat(recipientId);
      
      // Then send the message
      await sendMessage(chat.id, message);
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Message Sent',
        description: `Your message to ${recipientName} was sent successfully.`
      });
      
      // Close the modal
      onClose();
      
      // Optionally navigate to the messages page
      // Uncomment this if you want to redirect after sending
      // router.push(`/messages?chat=${chat.id}`);
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification({
        type: 'error',
        title: 'Message Failed',
        description: 'Unable to send your message. Please try again.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Message to {recipientName}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* Quick message suggestions */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Quick messages:
          </p>
          <div className="flex flex-wrap gap-2">
            {quickMessages.map((quickMessage, index) => (
              <button
                key={index}
                onClick={() => handleSelectQuickMessage(quickMessage)}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {quickMessage}
              </button>
            ))}
          </div>
        </div>
        
        {/* Message textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-4 min-h-[120px]"
        />
        
        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            isLoading={isSending}
            disabled={isSending || !message.trim()}
          >
            Send Message
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent, FormEvent } from 'react';
import { useMessages } from '@/lib/contexts/MessagesContext';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants';

const MessageComposer: React.FC = () => {
  const { sendMessage, selectedChatId, isSendingMessage } = useMessages();
  const [message, setMessage] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Handle input change and auto-resize
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    // Limit message length
    if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(e.target.value);
      
      // Auto-resize the textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(150, textareaRef.current.scrollHeight)}px`;
      }
    }
  };
  
  // Handle message submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!message.trim() || !selectedChatId || isSendingMessage) return;
    
    try {
      await sendMessage(message.trim());
      // Clear input on success
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // Focus back on textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show an error toast here
    }
  };
  
  // Handle Enter key (send on Enter, new line on Shift+Enter)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (message.trim() && selectedChatId && !isSendingMessage) {
        const form = e.currentTarget.form;
        if (form) {
          const fakeEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
          handleSubmit(fakeEvent);
        }
      }
    }
  };
  
  // Mock emoji picker (simplified for demo)
  const EmojiPicker: React.FC = () => {
    const emojis: string[] = ['😀', '😂', '👍', '❤️', '🏌️', '⛳', '🏆', '🍺', '👏', '🔥'];
    
    return (
      <div className="absolute bottom-full right-0 mb-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10 grid grid-cols-5 gap-2 animate-fadeIn">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => {
              setMessage(prev => prev + emoji);
              setShowEmojiPicker(false);
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
            className="w-8 h-8 text-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  };
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end space-x-2">
          <div className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all focus-within:border-green-500 dark:focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 overflow-hidden">
            {/* Main textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isSendingMessage}
                className="w-full resize-none p-3 pr-12 text-gray-900 dark:text-gray-100 bg-transparent border-0 focus:ring-0 focus:outline-none disabled:opacity-70"
                rows={1}
                style={{ minHeight: '45px', maxHeight: '150px' }}
              />
              
              {/* Character counter */}
              {message.length > 0 && (
                <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </div>
              )}
            </div>
            
            {/* Formatting options bar */}
            <div className="flex items-center p-2 border-t border-gray-200 dark:border-gray-700">
              {/* Emoji button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isSendingMessage}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-70"
              >
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {/* Emoji picker */}
              {showEmojiPicker && <EmojiPicker />}
              
              {/* GIF button */}
              <button
                type="button"
                disabled={isSendingMessage}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-70"
              >
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
                </svg>
              </button>
              
              {/* Attachment button */}
              <button
                type="button"
                disabled={isSendingMessage}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-70"
              >
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Send button with dynamic appearance based on message content */}
          <button
            type="submit"
            disabled={!message.trim() || isSendingMessage}
            className={`
              flex-shrink-0 p-3 rounded-full shadow-sm transition-all
              ${message.trim() && !isSendingMessage ? 
                'bg-green-500 hover:bg-green-600 text-white' : 
                'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'}
            `}
          >
            {isSendingMessage ? (
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageComposer;
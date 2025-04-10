'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  isSending?: boolean;
  placeholder?: string;
}

export function MessageComposer({ 
  onSendMessage, 
  isSending = false,
  placeholder = 'Type your message...' 
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea as the user types
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to recalculate
    textarea.style.height = 'auto';
    // Set the height to the scroll height (content height)
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // Handle message submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSending) return;
    
    onSendMessage(message);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Handle keyboard shortcuts (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4"
    >
      <div className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className={cn(
              "w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700",
              "bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "min-h-[40px] max-h-[150px] overflow-y-auto"
            )}
            disabled={isSending}
          />
        </div>
        
        <Button
          type="submit"
          disabled={!message.trim() || isSending}
          isLoading={isSending}
          className="flex-shrink-0"
        >
          Send
        </Button>
      </div>
    </form>
  );
}
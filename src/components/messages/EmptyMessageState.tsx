import React from 'react';
import { Button } from '@/components/ui/Button';

interface EmptyMessageStateProps {
  onNewChat?: () => void;
}

export function EmptyMessageState({ onNewChat }: EmptyMessageStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-10 h-10 text-gray-500 dark:text-gray-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      
      <h3 className="text-xl font-semibold mb-2">Your Messages</h3>
      
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
        Connect with fellow golfers, discuss tee times, and share tips to improve your game.
      </p>
      
      {onNewChat && (
        <Button onClick={onNewChat}>
          Start a New Conversation
        </Button>
      )}
    </div>
  );
}
// src/components/feed/NewPostsNotification.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

interface NewPostsNotificationProps {
  count: number;
  onLoadNewPosts: () => void;
}

export function NewPostsNotification({ 
  count, 
  onLoadNewPosts 
}: NewPostsNotificationProps) {
  if (count <= 0) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="sticky top-16 z-20 w-full flex justify-center pt-2 pb-1"
      >
        <Button
          onClick={onLoadNewPosts}
          className="bg-green-500 hover:bg-green-600 text-white shadow-md rounded-full px-4 py-2 flex items-center space-x-2"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 10l7-7m0 0l7 7m-7-7v18" 
            />
          </svg>
          <span>
            {count === 1 
              ? '1 new post' 
              : `${count} new posts`} available
          </span>
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
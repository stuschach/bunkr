// src/components/common/social/PostActions.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';

interface PostActionsProps {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  extraActions?: React.ReactNode;
  isLoading?: boolean;
  pendingLike?: boolean;
}

export function PostActions({ 
  isLiked, 
  likeCount, 
  commentCount, 
  onLike, 
  onComment, 
  onShare, 
  extraActions,
  isLoading = false,
  pendingLike = false
}: PostActionsProps) {
  return (
    <div className="flex items-center justify-between w-full text-gray-500 dark:text-gray-400">
      <div className="flex space-x-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className={`transition-all duration-200 ${isLiked ? "text-green-500" : ""} ${pendingLike ? "opacity-70" : ""}`}
          onClick={onLike}
          disabled={isLoading || pendingLike}
        >
          {pendingLike ? (
            <div className="flex items-center">
              <div className="w-4 h-4 mr-2 border-t-2 border-green-500 rounded-full animate-spin"></div>
              <svg
                className="mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </div>
          ) : (
            <svg
              className="mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isLiked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          )}
          {likeCount > 0 && <span className={pendingLike ? "animate-pulse" : ""}>{likeCount}</span>}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onComment}
          disabled={isLoading}
        >
          <svg
            className="mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount > 0 && <span>{commentCount}</span>}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onShare}
          disabled={isLoading}
        >
          <svg
            className="mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </Button>
      </div>
      
      {extraActions}
    </div>
  );
}
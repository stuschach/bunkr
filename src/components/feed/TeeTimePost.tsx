// src/components/feed/TeeTimePost.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance, format } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { Post } from '@/types/post';

interface TeeTimePostProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}

export function TeeTimePost({ 
  post, 
  onLike,
  onComment,
  onShare
}: TeeTimePostProps) {
  const router = useRouter();

  // Format date and time
  const formattedDate = post.dateTime ? format(
    new Date(post.dateTime.toDate()),
    'EEE, MMM d, yyyy'
  ) : '';
  
  const formattedTime = post.dateTime ? format(
    new Date(post.dateTime.toDate()),
    'h:mm a'
  ) : '';

  // Calculate time since post creation
  const timeAgo = post.createdAt ? formatDistance(
    new Date(post.createdAt),
    new Date(),
    { addSuffix: true }
  ) : '';

  const handleViewTeeTime = () => {
    router.push(`/tee-times/${post.teeTimeId}`);
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start space-x-3 mb-3">
          <Avatar 
            src={post.author?.photoURL} 
            alt={post.author?.displayName || 'User'} 
            size="md" 
          />
          <div>
            <div className="font-medium">{post.author?.displayName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{timeAgo}</div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <div className="mr-2">
              <Badge variant="outline">Tee Time</Badge>
            </div>
            <Heading level={4}>{post.courseName}</Heading>
          </div>
          
          <Text>{post.content}</Text>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3 mb-3">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Date & Time</div>
              <div className="font-medium">{formattedDate} • {formattedTime}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Group Size</div>
              <div className="font-medium">{post.maxPlayers} players</div>
            </div>
          </div>
          
          <Button 
            className="w-full"
            onClick={handleViewTeeTime}
          >
            View Tee Time
          </Button>
        </div>
      </CardContent>
      
      <CardFooter className="border-t border-gray-100 dark:border-gray-800 pt-3 pb-3">
        <div className="flex justify-between w-full">
          <Button
            variant="ghost"
            className={`${post.likedByUser ? 'text-green-500' : ''}`}
            onClick={onLike}
          >
            <svg
              className="w-5 h-5 mr-1"
              fill={post.likedByUser ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
              />
            </svg>
            {post.likes > 0 && <span>{post.likes}</span>}
          </Button>
          
          <Button
            variant="ghost"
            onClick={onComment}
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {post.comments > 0 && <span>{post.comments}</span>}
          </Button>
          
          <Button
            variant="ghost"
            onClick={onShare}
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
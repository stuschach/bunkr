// src/components/feed/VirtualizedPostList.tsx
// Updated with infinite scroll functionality

import React, { useCallback } from 'react';
import { Post } from '@/types/post';
import { PostCard } from '@/components/feed/PostCard';
import { RoundShareCard } from '@/components/feed/RoundShareCard';
import { TeeTimePost } from '@/components/feed/TeeTimePost';
import { SkeletonPostCard } from '@/components/feed/SkeletonPostCard';
import { Button } from '@/components/ui/Button';
import { useFetchOnVisible } from '@/lib/hooks/useFetchOnVisible';

interface VirtualizedPostListProps {
  posts: Post[];
  hasMore: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  loadMore: () => void;
  toggleLike: (postId: string, currentLikedStatus: boolean) => Promise<void>;
  handleComment: (postId: string) => void;
  handleShare: (postId: string) => void;
}

// Helper function to safely handle date objects from multiple sources
const safelyGetDate = (date: any): Date => {
  if (!date) return new Date();
  
  try {
    // Handle Firestore Timestamp objects with toDate method
    if (typeof date.toDate === 'function') {
      return date.toDate();
    }
    
    // Handle Date objects
    if (date instanceof Date) {
      return date;
    }
    
    // Handle timestamp-like objects with seconds/nanoseconds
    if (date.seconds !== undefined) {
      return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    
    // Handle ISO strings
    if (typeof date === 'string') {
      return new Date(date);
    }
    
    // Default fallback
    return new Date();
  } catch (e) {
    console.error("Error parsing date:", e);
    return new Date();
  }
};

export function VirtualizedPostList({ 
  posts, 
  hasMore, 
  isLoadingMore, 
  error, 
  loadMore, 
  toggleLike, 
  handleComment, 
  handleShare 
}: VirtualizedPostListProps) {
  
  // Function to call loadMore when the sentinel becomes visible
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMore();
    }
  }, [loadMore, isLoadingMore, hasMore]);
  
  // Use our custom hook to set up the intersection observer
  const loadMoreRef = useFetchOnVisible(handleLoadMore, {
    threshold: 0.5,
    enabled: hasMore && !isLoadingMore
  });
  
  // Show error message if there's an error
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 my-4 text-red-700 dark:text-red-300">
        <p>Error loading feed: {error.message}</p>
        <Button 
          onClick={loadMore} 
          className="mt-2 px-4 py-2 bg-red-100 dark:bg-red-800 rounded-md"
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  // Show empty state if there are no posts
  if (posts.length === 0 && !isLoadingMore) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No posts found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Follow golfers or create your first post to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Render all posts with proper spacing and unique compound keys */}
      {posts.map((post, index) => {
        // Process post data
        const processedPost = {
          ...post,
          createdAt: safelyGetDate(post.createdAt),
          dateTime: post.dateTime ? safelyGetDate(post.dateTime) : undefined
        };
        
        // Render post based on type
        if (post.postType === 'round' && post.roundId) {
          return (
            <div key={`${post.id}-${index}`} className="mb-4">
              <RoundShareCard
                round={processedPost}
                user={post.author || {
                  uid: '', 
                  displayName: '', 
                  photoURL: '', 
                  createdAt: new Date(), 
                  email: null, 
                  handicapIndex: null, 
                  homeCourse: null, 
                  profileComplete: false
                }}
                postId={post.id}
                showActions={true}
                onLike={() => toggleLike(post.id, post.likedByUser || false)}
                onComment={() => handleComment(post.id)}
                onShare={() => handleShare(post.id)}
                likedByUser={post.likedByUser || false}
                likes={post.likes || 0}
                comments={post.comments || 0}
              />
            </div>
          );
        } else if (post.postType === 'tee-time') {
          return (
            <div key={`${post.id}-${index}`} className="mb-4">
              <TeeTimePost
                post={processedPost}
                onLike={() => toggleLike(post.id, post.likedByUser || false)}
                onComment={() => handleComment(post.id)}
                onShare={() => handleShare(post.id)}
              />
            </div>
          );
        } else {
          return (
            <div key={`${post.id}-${index}`} className="mb-4">
              <PostCard
                post={processedPost}
                onLike={() => toggleLike(post.id, post.likedByUser || false)}
                onComment={() => handleComment(post.id)}
                onShare={() => handleShare(post.id)}
              />
            </div>
          );
        }
      })}
      
      {/* Loading indicator - now automatic when the sentinel is visible */}
      {isLoadingMore && (
        <div className="mb-4">
          <SkeletonPostCard />
        </div>
      )}
      
      {/* Sentinel element for infinite scrolling */}
      {hasMore && !isLoadingMore && (
        <div 
          ref={loadMoreRef} 
          className="h-20 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm"
        >
          Scroll for more
        </div>
      )}
      
      {/* End of feed message */}
      {!hasMore && posts.length > 0 && (
        <div className="py-6 text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          <div className="text-lg mb-2">You've reached the end</div>
          <p className="text-sm">No more posts to show. Follow more golfers to see more content!</p>
        </div>
      )}
    </div>
  );
}

VirtualizedPostList.displayName = 'VirtualizedPostList';
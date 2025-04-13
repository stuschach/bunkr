// src/components/profile/ProfileTabs.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { PostCard } from '@/components/feed/PostCard';
import { RoundShareCard } from '@/components/feed/RoundShareCard';
import { UserProfile } from '@/types/auth';
import { Post } from '@/types/post';
import { Scorecard } from '@/types/scorecard';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface ProfileTabsProps {
  profile: UserProfile;
  posts: Post[];
  rounds: Scorecard[];
  isLoading?: boolean;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onViewScorecard?: (roundId: string) => void;
  onLoadMorePosts?: () => void;
  onLoadMoreRounds?: () => void;
  hasMorePosts?: boolean;
  hasMoreRounds?: boolean;
}

export function ProfileTabs({
  profile,
  posts,
  rounds,
  isLoading = false,
  onLike,
  onComment,
  onShare,
  onViewScorecard,
  onLoadMorePosts,
  onLoadMoreRounds,
  hasMorePosts = false,
  hasMoreRounds = false,
}: ProfileTabsProps) {
  // Track loading states for infinite scrolling
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [isLoadingMoreRounds, setIsLoadingMoreRounds] = useState(false);
  
  // References for scroll containers
  const postsContainerRef = useRef<HTMLDivElement>(null);
  const roundsContainerRef = useRef<HTMLDivElement>(null);

  // Track active tab for proper scroll handling
  const [activeTab, setActiveTab] = useState('posts');
  
  // Observer for infinite scrolling
  const postsObserverRef = useRef<IntersectionObserver | null>(null);
  const roundsObserverRef = useRef<IntersectionObserver | null>(null);
  
  // References for sentinel elements (for infinite scrolling)
  const postsSentinelRef = useRef<HTMLDivElement>(null);
  const roundsSentinelRef = useRef<HTMLDivElement>(null);

  // Handle loading more posts
  const handleLoadMorePosts = useCallback(async () => {
    if (isLoadingMorePosts || !onLoadMorePosts || !hasMorePosts) return;
    
    setIsLoadingMorePosts(true);
    await onLoadMorePosts();
    setIsLoadingMorePosts(false);
  }, [isLoadingMorePosts, onLoadMorePosts, hasMorePosts]);

  // Handle loading more rounds
  const handleLoadMoreRounds = useCallback(async () => {
    if (isLoadingMoreRounds || !onLoadMoreRounds || !hasMoreRounds) return;
    
    setIsLoadingMoreRounds(true);
    await onLoadMoreRounds();
    setIsLoadingMoreRounds(false);
  }, [isLoadingMoreRounds, onLoadMoreRounds, hasMoreRounds]);

  // Setup intersection observers for infinite scrolling
  useEffect(() => {
    // Create observers for infinite scrolling
    postsObserverRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMorePosts && !isLoadingMorePosts) {
          handleLoadMorePosts();
        }
      },
      { rootMargin: '200px' } // Start loading before user reaches the bottom
    );

    roundsObserverRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMoreRounds && !isLoadingMoreRounds) {
          handleLoadMoreRounds();
        }
      },
      { rootMargin: '200px' }
    );

    // Observe the sentinel elements if they exist
    if (postsSentinelRef.current && activeTab === 'posts') {
      postsObserverRef.current.observe(postsSentinelRef.current);
    }

    if (roundsSentinelRef.current && activeTab === 'rounds') {
      roundsObserverRef.current.observe(roundsSentinelRef.current);
    }

    // Cleanup
    return () => {
      if (postsObserverRef.current) {
        postsObserverRef.current.disconnect();
      }
      if (roundsObserverRef.current) {
        roundsObserverRef.current.disconnect();
      }
    };
  }, [
    hasMorePosts, 
    hasMoreRounds, 
    isLoadingMorePosts, 
    isLoadingMoreRounds,
    handleLoadMorePosts,
    handleLoadMoreRounds,
    activeTab
  ]);

  // When tab changes, update observers
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    // Reset observers
    if (postsObserverRef.current) {
      postsObserverRef.current.disconnect();
      if (tabId === 'posts' && postsSentinelRef.current) {
        postsObserverRef.current.observe(postsSentinelRef.current);
      }
    }
    
    if (roundsObserverRef.current) {
      roundsObserverRef.current.disconnect();
      if (tabId === 'rounds' && roundsSentinelRef.current) {
        roundsObserverRef.current.observe(roundsSentinelRef.current);
      }
    }
  };

  const postsContent = (
    <div 
      ref={postsContainerRef} 
      className="space-y-4 overflow-auto"
      style={{ maxHeight: '80vh' }}
    >
      {isLoading && posts.length === 0 ? (
        // Loading skeleton for initial load
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-40 animate-pulse"></div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <>
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={onLike ? () => onLike(post.id) : undefined}
                onComment={onComment ? () => onComment(post.id) : undefined}
                onShare={onShare ? () => onShare(post.id) : undefined}
              />
            ))}
          </div>
          
          {/* Sentinel element for infinite scrolling */}
          {hasMorePosts && (
            <div 
              ref={postsSentinelRef} 
              className="h-10 flex items-center justify-center"
            >
              {isLoadingMorePosts && (
                <LoadingSpinner size="sm" color="primary" />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No posts yet
        </div>
      )}
    </div>
  );

  const roundsContent = (
    <div 
      ref={roundsContainerRef} 
      className="space-y-4 overflow-auto"
      style={{ maxHeight: '80vh' }}
    >
      {isLoading && rounds.length === 0 ? (
        // Loading skeleton for rounds
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-40 animate-pulse"></div>
          ))}
        </div>
      ) : rounds.length > 0 ? (
        <>
          <div className="space-y-4">
            {rounds.map((round) => (
              <RoundShareCard 
                key={round.id} 
                round={round} 
                user={profile} 
                onViewScorecard={onViewScorecard ? () => onViewScorecard(round.id) : undefined}
              />
            ))}
          </div>
          
          {/* Sentinel element for infinite scrolling */}
          {hasMoreRounds && (
            <div 
              ref={roundsSentinelRef} 
              className="h-10 flex items-center justify-center"
            >
              {isLoadingMoreRounds && (
                <LoadingSpinner size="sm" color="primary" />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No rounds logged yet
        </div>
      )}
    </div>
  );

  const tabs = [
    {
      id: 'posts',
      label: 'Posts',
      content: postsContent,
    },
    {
      id: 'rounds',
      label: 'Rounds',
      content: roundsContent,
    },
  ];

  return <Tabs tabs={tabs} onChange={handleTabChange} />;
}

export default ProfileTabs;
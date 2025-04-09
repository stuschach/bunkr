// src/components/profile/ProfileTabs.tsx
import React from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { PostCard } from '@/components/feed/PostCard';
import { RoundShareCard } from '@/components/feed/RoundShareCard';
import { UserProfile } from '@/types/auth';
import { Post } from '@/types/post';
import { Scorecard } from '@/types/scorecard';

interface ProfileTabsProps {
  profile: UserProfile;
  posts: Post[];
  rounds: Scorecard[];
  isLoading?: boolean;
}

export function ProfileTabs({
  profile,
  posts,
  rounds,
  isLoading = false,
}: ProfileTabsProps) {
  const postsContent = (
    <div className="space-y-4">
      {isLoading ? (
        // Loading skeleton for posts
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-40 animate-pulse"></div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No posts yet
        </div>
      )}
    </div>
  );

  const roundsContent = (
    <div className="space-y-4">
      {isLoading ? (
        // Loading skeleton for rounds
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-40 animate-pulse"></div>
          ))}
        </div>
      ) : rounds.length > 0 ? (
        rounds.map((round) => (
          <RoundShareCard key={round.id} round={round} user={profile} />
        ))
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

  return <Tabs tabs={tabs} />;
}
// src/app/(app)/profile/[username]/page.tsx
'use client';

import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFollowContext } from '@/lib/contexts/FollowContext';
import { UserProfile } from '@/types/auth';

// Lazy-load components that aren't immediately visible
const ProfileStats = lazy(() => 
  import('@/components/profile/ProfileStats').then(mod => ({ default: mod.ProfileStats }))
);
const HandicapDisplay = lazy(() => 
  import('@/components/profile/HandicapDisplay').then(mod => ({ default: mod.HandicapDisplay }))
);
const AchievementBadges = lazy(() => 
  import('@/components/profile/AchievementBadges').then(mod => ({ default: mod.AchievementBadges }))
);
const ProfileTabs = lazy(() => 
  import('@/components/profile/ProfileTabs').then(mod => ({ default: mod.ProfileTabs }))
);

// Custom hooks for data fetching
import { useProfileData } from '@/lib/hooks/useProfileData';
import { useProfileStats } from '@/lib/hooks/useProfileStats';
import { useProfileContent } from '@/lib/hooks/useProfileContent';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshFollowState } = useFollowContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get username from params
  const username = params.username as string;
  
  // Use custom hooks for separate data concerns
  const { profile, loadProfile } = useProfileData();
  const { stats, loadStats } = useProfileStats(username);
  
  // For infinite scrolling
  const [postsPage, setPostsPage] = useState(1);
  const [roundsPage, setRoundsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreRounds, setHasMoreRounds] = useState(true);
  const itemsPerPage = 5;
  
  // Use profile content hook with pagination
  const { 
    posts, 
    rounds, 
    loadContent, 
    loadMorePosts, 
    loadMoreRounds 
  } = useProfileContent(username, itemsPerPage);
  
  // Track content loading state separately
  const [contentLoading, setContentLoading] = useState(true);
  
  // Progressive loading
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  // Check if this is the user's own profile
  const isOwnProfile = user?.uid === profile?.uid;

  // Load core profile data first
  useEffect(() => {
    async function loadProfileData() {
      if (!username) {
        setError("User ID not provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Only load the core profile data first
        const userDocRef = doc(db, 'users', username);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setError("User profile not found");
          setIsLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        
        // Process basic profile data
        const profileData: UserProfile = {
          uid: userDoc.id,
          email: userData.email || null,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
          coverPhotoURL: userData.coverPhotoURL || null,
          createdAt: userData.createdAt?.toDate() || new Date(),
          handicapIndex: userData.handicapIndex || null,
          homeCourse: userData.homeCourse || null,
          profileComplete: userData.profileComplete || false,
          bio: userData.bio || null
        };
        
        await loadProfile(profileData);
        
        // Always refresh follow state
        refreshFollowState(username);
        
        setProfileLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error("[ProfilePage] Error loading profile:", err);
        setError(`Error loading profile: ${err instanceof Error ? err.message : "Unknown error"}`);
        setIsLoading(false);
      }
    }
    
    loadProfileData();
  }, [username, refreshFollowState, loadProfile]);

  // After profile is loaded, load other data
  useEffect(() => {
    if (profile && profileLoaded) {
      // Initiate secondary data loading
      setContentLoading(true);
      loadStats(profile);
      loadContent(profile).finally(() => {
        setContentLoading(false);
      });
    }
  }, [profile, profileLoaded, loadStats, loadContent]);

  // Handle loading more posts for infinite scrolling
  const handleLoadMorePosts = useCallback(async () => {
    if (!hasMorePosts) return;
    
    const nextPage = postsPage + 1;
    const result = await loadMorePosts(nextPage);
    
    // Update state based on result
    setPostsPage(nextPage);
    setHasMorePosts(result.hasMore);
  }, [postsPage, hasMorePosts, loadMorePosts]);

  // Handle loading more rounds for infinite scrolling
  const handleLoadMoreRounds = useCallback(async () => {
    if (!hasMoreRounds) return;
    
    const nextPage = roundsPage + 1;
    const result = await loadMoreRounds(nextPage);
    
    // Update state based on result
    setRoundsPage(nextPage);
    setHasMoreRounds(result.hasMore);
  }, [roundsPage, hasMoreRounds, loadMoreRounds]);

  // Handle post actions
  const handleLike = useCallback((postId: string) => {
    // Implement optimistic update logic
    console.log('Like post:', postId);
  }, []);

  const handleComment = useCallback((postId: string) => {
    console.log('Comment on post:', postId);
  }, []);

  const handleShare = useCallback((postId: string) => {
    console.log('Share post:', postId);
  }, []);

  // Handle viewing scorecard
  const handleViewScorecard = useCallback((roundId: string) => {
    if (roundId) {
      router.push(`/scorecard/${roundId}`);
    }
  }, [router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading profile..." />
        <p className="mt-4 text-gray-500">This might take a moment...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
            {error}
          </h2>
          <div className="flex justify-center gap-2">
            <Button onClick={() => router.push('/login')}>
              Log In
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Profile not found
  if (!profile) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">User not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          The user you're looking for doesn't exist or may have been removed.
        </p>
        <Button onClick={() => router.push('/')}>
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      {/* ProfileHeader always loads first since it's critical */}
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onFollowChange={(isFollowing) => console.log(`Follow status changed: ${isFollowing}`)}
        onFollowerCountChange={(count) => console.log(`Follower count changed: ${count}`)}
      />
      
      {/* Progressive loading with Suspense fallbacks */}
      <Suspense fallback={<div className="mb-6 h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>}>
        {stats.achievements?.length > 0 && (
          <div className="mb-6">
            <AchievementBadges achievements={stats.achievements} compact={true} />
          </div>
        )}
      </Suspense>
      
      <Suspense fallback={<div className="mb-6 h-44 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>}>
        <ProfileStats
          handicapIndex={profile.handicapIndex}
          roundsPlayed={stats.roundsPlayed}
          averageScore={stats.averageScore}
          bestScore={stats.bestScore}
          fairwaysHitPercentage={stats.advancedStats.fairwaysHitPercentage}
          greensInRegulationPercentage={stats.advancedStats.greensInRegulationPercentage}
          averagePuttsPerRound={stats.advancedStats.averagePuttsPerRound}
          averageDrivingDistance={stats.advancedStats.averageDrivingDistance}
        />
      </Suspense>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-1">
          <Suspense fallback={<div className="h-48 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>}>
            <HandicapDisplay 
              handicapIndex={profile.handicapIndex}
              trend={stats.handicapTrend}
              history={stats.handicapHistory}
            />
          </Suspense>
          
          <Suspense fallback={<div className="mt-6 h-56 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>}>
            {stats.achievements?.length > 0 && (
              <div className="mt-6">
                <AchievementBadges achievements={stats.achievements} />
              </div>
            )}
          </Suspense>
        </div>
        
        <div className="md:col-span-2">
          <Suspense fallback={
            <Card>
              <div className="p-6 flex flex-col space-y-4">
                <div className="h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded w-1/3"></div>
                <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
                <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
                <div className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
              </div>
            </Card>
          }>
            <ProfileTabs
              profile={profile}
              posts={posts.regularPosts || []}
              rounds={Array.isArray(rounds) ? rounds : []}
              isLoading={contentLoading}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onViewScorecard={handleViewScorecard}
              onLoadMorePosts={handleLoadMorePosts}
              onLoadMoreRounds={handleLoadMoreRounds}
              hasMorePosts={hasMorePosts}
              hasMoreRounds={hasMoreRounds}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
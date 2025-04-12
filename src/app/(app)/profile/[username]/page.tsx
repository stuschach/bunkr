// src/app/(app)/profile/[username]/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { HandicapDisplay } from '@/components/profile/HandicapDisplay';
import { AchievementBadges, Achievement } from '@/components/profile/AchievementBadges';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFollowContext } from '@/lib/contexts/FollowContext';
import { UserProfile } from '@/types/auth';
import { Scorecard } from '@/types/scorecard';
import { Post } from '@/types/post';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshFollowState } = useFollowContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get username from params
  const username = params.username as string;
  
  // Content data
  const [allPosts, setAllPosts] = useState<Post[]>([]); // Store all posts
  const [regularPosts, setRegularPosts] = useState<Post[]>([]); // Only non-round posts
  const [rounds, setRounds] = useState<Scorecard[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  
  // Stats data
  const [bestScore, setBestScore] = useState<any>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [advancedStats, setAdvancedStats] = useState({
    fairwaysHitPercentage: null as number | null,
    greensInRegulationPercentage: null as number | null,
    averagePuttsPerRound: null as number | null,
    averageDrivingDistance: null as number | null
  });
  
  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  // Handicap history for trend
  const [handicapHistory, setHandicapHistory] = useState<Array<{date: string, value: number}>>([]);
  const [handicapTrend, setHandicapTrend] = useState<'improving' | 'declining' | 'stable'>('stable');

  // Always refresh follow state when a profile is loaded, regardless of whose profile it is
  const refreshFollow = useCallback(() => {
    if (user && username) {
      refreshFollowState(username);
    }
  }, [user, username, refreshFollowState]);

  // Fetch posts for this user
  const fetchPosts = useCallback(async (userId: string, profileData: UserProfile) => {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      // Process posts with proper author information
      const postsData = postsSnapshot.docs.map(doc => {
        const postData = doc.data();
        
        // Check if the current user has liked this post
        const likedByUser = postData.likedBy?.includes(auth.currentUser?.uid) || false;
        
        // Convert Firestore timestamp to Date
        const createdAt = postData.createdAt?.toDate() || new Date();
        
        // Create a new post object with author property
        return {
          id: doc.id,
          authorId: userId,
          content: postData.content || '',
          media: postData.media || [],
          createdAt: createdAt,
          postType: postData.postType || 'regular',
          visibility: postData.visibility || 'public',
          likes: postData.likes || 0,
          comments: postData.comments || 0,
          likedByUser: likedByUser,
          likedBy: postData.likedBy || [],
          hashtags: postData.hashtags || [],
          location: postData.location || null,
          roundId: postData.roundId || null,
          eventId: postData.eventId || null,
          marketplaceId: postData.marketplaceId || null,
          teeTimeId: postData.teeTimeId || null,
          courseName: postData.courseName || null,
          dateTime: postData.dateTime?.toDate() || null,
          maxPlayers: postData.maxPlayers || null,
          author: profileData
        } as Post;
      });
      
      // Set all posts
      setAllPosts(postsData);
      
      // Filter regular posts
      const filteredRegularPosts = postsData.filter(post => post.postType !== 'round');
      setRegularPosts(filteredRegularPosts);
      
    } catch (error) {
      console.error("[ProfilePage] Error fetching posts:", error);
    }
  }, []);
  
  // Fetch rounds/scorecards for this user
  const fetchRounds = useCallback(async (userId: string) => {
    try {
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(10)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const roundsData = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Scorecard));
      
      setRounds(roundsData);
      
      // Calculate statistics from rounds
      if (roundsData.length > 0) {
        calculateStats(roundsData);
      }
    } catch (error) {
      console.error("[ProfilePage] Error fetching rounds:", error);
    }
  }, []);
  
  // Calculate golf statistics
  const calculateStats = useCallback((roundsData: Scorecard[]) => {
    try {
      // Calculate average score
      const totalScore = roundsData.reduce((sum, round) => sum + round.totalScore, 0);
      const avgScore = roundsData.length > 0 ? totalScore / roundsData.length : null;
      setAverageScore(avgScore !== null ? parseFloat(avgScore.toFixed(1)) : null);
      
      // Find best round (lowest score to par)
      const best = roundsData.reduce<any>((best, current) => {
        const currentScoreToPar = current.totalScore - current.coursePar;
        const bestScoreToPar = best ? (best.totalScore - best.coursePar) : Infinity;
        return currentScoreToPar < bestScoreToPar ? current : best;
      }, null);
      
      if (best) {
        setBestScore({
          score: best.totalScore,
          course: best.courseName,
          date: best.date,
          par: best.coursePar
        });
      }
      
      // Calculate advanced stats if available in round data
      let fairwaysHit = 0;
      let fairwaysTotal = 0;
      let greensInReg = 0;
      let greensTotal = 0;
      let totalPutts = 0;
      let drivingDistanceSum = 0;
      let drivingDistanceCount = 0;
      
      roundsData.forEach(round => {
        if (round.stats) {
          // Fairways hit
          if (typeof round.stats.fairwaysHit === 'number' && typeof round.stats.fairwaysTotal === 'number') {
            fairwaysHit += round.stats.fairwaysHit;
            fairwaysTotal += round.stats.fairwaysTotal;
          }
          
          // Greens in regulation
          if (typeof round.stats.greensInRegulation === 'number') {
            greensInReg += round.stats.greensInRegulation;
            greensTotal += 18; // Assuming 18 holes
          }
          
          // Putts
          if (typeof round.stats.totalPutts === 'number') {
            totalPutts += round.stats.totalPutts;
          }
          
          // Driving distance - fixed with proper type checking
          if (typeof round.stats.averageDrivingDistance === 'number') {
            drivingDistanceSum += round.stats.averageDrivingDistance;
            drivingDistanceCount++;
          }
        }
      });
      
      // Update advanced stats
      setAdvancedStats({
        fairwaysHitPercentage: fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : null,
        greensInRegulationPercentage: greensTotal > 0 ? (greensInReg / greensTotal) * 100 : null,
        averagePuttsPerRound: roundsData.length > 0 ? totalPutts / roundsData.length : null,
        averageDrivingDistance: drivingDistanceCount > 0 ? Math.round(drivingDistanceSum / drivingDistanceCount) : null
      });
      
    } catch (error) {
      console.error("[ProfilePage] Error calculating stats:", error);
    }
  }, []);
  
  // Fetch user achievements - Sample implementation
  const fetchAchievements = useCallback(async (userId: string) => {
    try {
      // In a real app, this would fetch from a database
      // For demo purposes, generating sample achievements based on profile
      
      const achievementsData: Achievement[] = [];
      
      // Hole in One achievement (random chance for demo)
      if (Math.random() > 0.7) {
        achievementsData.push({
          id: 'hole-in-one',
          name: 'Hole in One',
          description: 'Score a hole in one on a par 3',
          icon: '🎯',
          dateEarned: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          category: 'skill',
          rarity: 'legendary'
        });
      }
      
      // Breaking 80 achievement
      achievementsData.push({
        id: 'breaking-80',
        name: 'Breaking 80',
        description: 'Score under 80 in a round',
        icon: '🏆',
        dateEarned: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        category: 'score',
        rarity: 'rare'
      });
      
      // Social achievements
      achievementsData.push({
        id: 'social-50',
        name: 'Golf Networker',
        description: 'Connect with 50+ golfers',
        icon: '👥',
        dateEarned: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        category: 'social',
        rarity: 'uncommon'
      });
      
      // Round count achievement
      if (rounds.length >= 10) {
        achievementsData.push({
          id: 'dedicated-golfer',
          name: 'Dedicated Golfer',
          description: 'Play 10+ rounds of golf',
          icon: '⛳',
          dateEarned: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          category: 'progress',
          rarity: 'common'
        });
      }
      
      // Set achievements
      setAchievements(achievementsData);
      
    } catch (error) {
      console.error("[ProfilePage] Error fetching achievements:", error);
    }
  }, [rounds.length]);
  
  // Fetch handicap history to determine trend
  const fetchHandicapHistory = useCallback(async (userId: string) => {
    try {
      // In a real app, this would fetch from a history collection
      // For demo purposes, generating sample history
      
      const now = new Date();
      const history = [];
      
      // Generate 6 months of data points
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        
        // Start with a base handicap of 15 and add some variation
        // For demo purposes, we'll have it slightly improve over time
        const baseHandicap = 15;
        const variation = Math.random() * 2 - 1; // Random variation between -1 and 1
        const improvement = 0.2 * i; // Small improvement over time
        
        const value = baseHandicap - improvement + variation;
        
        history.push({
          date: date.toISOString().split('T')[0],
          value: parseFloat(value.toFixed(1))
        });
      }
      
      setHandicapHistory(history);
      
      // Determine trend based on last two values
      if (history.length >= 2) {
        const last = history[history.length - 1].value;
        const secondLast = history[history.length - 2].value;
        
        if (last < secondLast - 0.2) {
          setHandicapTrend('improving');
        } else if (last > secondLast + 0.2) {
          setHandicapTrend('declining');
        } else {
          setHandicapTrend('stable');
        }
      }
      
    } catch (error) {
      console.error("[ProfilePage] Error fetching handicap history:", error);
    }
  }, []);

  // Effect for loading profile data - note the stable dependencies
  useEffect(() => {
    async function fetchData() {
      if (!username) {
        setError("User ID not provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`[ProfilePage] Loading profile for user: ${username}`);
        
        // First fetch user profile
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
        
        setProfile(profileData);
        
        // Always refresh follow state
        refreshFollow();
        
        // Now fetch additional content in parallel
        setIsLoadingContent(true);
        
        const fetchPromises = [
          fetchPosts(username, profileData),
          fetchRounds(username),
          fetchAchievements(username),
          fetchHandicapHistory(username)
        ];
        
        await Promise.all(fetchPromises);
        
        setIsLoadingContent(false);
        setIsLoading(false);
      } catch (err) {
        console.error("[ProfilePage] Error loading profile:", err);
        setError(`Error loading profile: ${err instanceof Error ? err.message : "Unknown error"}`);
        setIsLoading(false);
        setIsLoadingContent(false);
      }
    }
    
    fetchData();
  }, [
    username, 
    refreshFollow, 
    fetchPosts, 
    fetchRounds, 
    fetchAchievements, 
    fetchHandicapHistory
  ]);

  // Handle post like/unlike
  const toggleLike = async (postId: string) => {
    if (!auth.currentUser) return;
    
    // Find the post
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    
    const newLikedStatus = !post.likedByUser;
    
    try {
      const postRef = doc(db, 'posts', postId);
      
      // Update Firestore document
      if (newLikedStatus) {
        // Like the post
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(auth.currentUser.uid)
        });
      } else {
        // Unlike the post
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(auth.currentUser.uid)
        });
      }
      
      // Update both post states
      const updatePost = (posts: Post[]) => 
        posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              likes: newLikedStatus ? p.likes + 1 : p.likes - 1,
              likedByUser: newLikedStatus,
            };
          }
          return p;
        });
      
      setAllPosts(updatePost(allPosts));
      setRegularPosts(updatePost(regularPosts));
      
    } catch (error) {
      console.error('[ProfilePage] Error updating like status:', error);
    }
  };

  // Handle comment
  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId);
  };

  // Handle share
  const handleShare = (postId: string) => {
    console.log('Share post:', postId);
  };

  // Function to handle navigating to the scorecard view
  const handleViewScorecard = (roundId: string) => {
    if (roundId) {
      router.push(`/scorecard/${roundId}`);
    }
  };

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

  // Check if this is the user's own profile
  const isOwnProfile = auth.currentUser?.uid === profile.uid;

  // Successfully loaded profile
  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onFollowChange={(isFollowing) => console.log(`Follow status changed: ${isFollowing}`)}
        onFollowerCountChange={(count) => console.log(`Follower count changed: ${count}`)}
      />
      
      {/* Achievements Badges - Compact Mode */}
      {achievements.length > 0 && (
        <div className="mb-6">
          <AchievementBadges achievements={achievements} compact={true} />
        </div>
      )}
      
      <ProfileStats
        handicapIndex={profile.handicapIndex}
        roundsPlayed={rounds.length}
        averageScore={averageScore}
        bestScore={bestScore}
        fairwaysHitPercentage={advancedStats.fairwaysHitPercentage}
        greensInRegulationPercentage={advancedStats.greensInRegulationPercentage}
        averagePuttsPerRound={advancedStats.averagePuttsPerRound}
        averageDrivingDistance={advancedStats.averageDrivingDistance}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-1">
          <HandicapDisplay 
            handicapIndex={profile.handicapIndex}
            trend={handicapTrend}
            history={handicapHistory}
          />
          
          {/* Full Achievements Display */}
          {achievements.length > 0 && (
            <div className="mt-6">
              <AchievementBadges achievements={achievements} />
            </div>
          )}
        </div>
        
        <div className="md:col-span-2">
          {isLoadingContent ? (
            <Card>
              <CardContent className="p-6 flex justify-center items-center min-h-[300px]">
                <LoadingSpinner size="md" color="primary" label="Loading content..." />
              </CardContent>
            </Card>
          ) : (
            <ProfileTabs
              profile={profile}
              posts={regularPosts} // Pass filtered posts (non-round posts)
              rounds={rounds}
              isLoading={false}
              onLike={toggleLike}
              onComment={handleComment}
              onShare={handleShare}
              onViewScorecard={handleViewScorecard}
            />
          )}
        </div>
      </div>
    </div>
  );
}
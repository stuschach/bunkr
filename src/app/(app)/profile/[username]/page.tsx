// src/app/(app)/profile/[username]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { HandicapDisplay } from '@/components/profile/HandicapDisplay';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { isFollowing } from '@/lib/firebase/connections';
import { UserProfile } from '@/types/auth';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get username from params
  const username = params.username as string;
  
  // For social data
  const [userIsFollowing, setUserIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bestScore, setBestScore] = useState<any>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");

  // Ultra-simple fetch with no dependencies
  useEffect(() => {
    console.log("🔄 Profile page mounted");
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      
      try {
        // 1. Check if logged in
        setLoadingMessage("Checking authentication...");
        if (!auth.currentUser) {
          console.log("❌ Not logged in");
          setError("Please log in to view profiles");
          setIsLoading(false);
          return;
        }
        
        console.log(`✅ User authenticated: ${auth.currentUser.uid}`);
        
        // 2. Get user ID from params
        setLoadingMessage("Identifying profile...");
        const targetUserId = username;
        
        if (!targetUserId) {
          console.log("❌ No user ID parameter found");
          setError("User ID not provided");
          setIsLoading(false);
          return;
        }
        
        console.log(`🔍 Looking up profile: ${targetUserId}`);
        
        // 3. Fetch user document
        setLoadingMessage("Loading profile data...");
        const userDocRef = doc(db, 'users', targetUserId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.log("❌ User document not found");
          setError("User profile not found");
          setIsLoading(false);
          return;
        }
        
        console.log("✅ Found user document");
        const userData = userDoc.data();
        
        // 4. Process basic profile data
        setLoadingMessage("Processing profile...");
        if (!isMounted) return;
        
        const profileData: UserProfile = {
          uid: userDoc.id,
          email: userData.email || null,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
          createdAt: userData.createdAt?.toDate() || new Date(),
          handicapIndex: userData.handicapIndex || null,
          homeCourse: userData.homeCourse || null,
          profileComplete: userData.profileComplete || false,
          bio: userData.bio || null
        };
        
        console.log(`📋 Profile data processed: ${profileData.displayName}`);
        
        // 5. Set social counts
        const followerCountValue = userData.followerCount || 0;
        const followingCountValue = userData.followingCount || 0;
        
        console.log(`👥 Follower count: ${followerCountValue}, Following count: ${followingCountValue}`);
        
        // 6. Check follow status if needed
        setLoadingMessage("Checking relationship...");
        let followStatus = false;
        
        if (auth.currentUser.uid !== targetUserId) {
          try {
            followStatus = await isFollowing(auth.currentUser.uid, targetUserId);
            console.log(`🔗 Follow status: ${followStatus}`);
          } catch (followErr) {
            console.error("⚠️ Error checking follow status:", followErr);
            // Don't fail if just the follow check fails
          }
        }
        
        // 7. Set demo data
        setLoadingMessage("Finalizing...");
        if (!isMounted) return;
        
        // 8. Update all state at once to minimize renders
        setProfile(profileData);
        setFollowerCount(followerCountValue);
        setFollowingCount(followingCountValue);
        setUserIsFollowing(followStatus);
        setPosts([]);
        setRounds([]);
        setAverageScore(78.5);
        setBestScore({
          score: 72,
          course: "Chambers Bay",
          date: "2024-03-15",
          par: 72
        });
        setIsLoading(false);
        
        console.log("✅ Profile page fully loaded");
        
      } catch (err) {
        if (!isMounted) return;
        
        console.error("❌ Error loading profile:", err);
        setError(`Error loading profile: ${err instanceof Error ? err.message : "Unknown error"}`);
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      console.log("🔄 Profile page unmounted");
    };
  }, [username]); // Only depend on username to avoid re-runs

  // Handle follow state change
  const handleFollowChange = (newFollowingState: boolean) => {
    console.log(`👤 Follow state changed to: ${newFollowingState}`);
    setUserIsFollowing(newFollowingState);
  };
  
  // Handle follower count change
  const handleFollowerCountChange = (newCount: number) => {
    console.log(`👥 Follower count changed to: ${newCount}`);
    setFollowerCount(newCount);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading profile..." />
        <p className="mt-4 text-gray-500">{loadingMessage}</p>
        <div className="mt-8">
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </div>
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
        isFollowing={userIsFollowing}
        followerCount={followerCount}
        followingCount={followingCount}
        onFollowChange={handleFollowChange}
        onFollowerCountChange={handleFollowerCountChange}
      />
      
      <ProfileStats
        handicapIndex={profile.handicapIndex}
        roundsPlayed={rounds.length}
        averageScore={averageScore}
        bestScore={bestScore}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-1">
          <HandicapDisplay 
            handicapIndex={profile.handicapIndex}
            trend="improving"
            history={[]} // Replace with actual history data when available
          />
        </div>
        
        <div className="md:col-span-2">
          <ProfileTabs
            profile={profile}
            posts={posts}
            rounds={rounds}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  );
}
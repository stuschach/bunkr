'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { HandicapDisplay } from '@/components/profile/HandicapDisplay';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bestScore, setBestScore] = useState<any>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  
  // Direct auth check
  const [authChecked, setAuthChecked] = useState(false);
  
  // Check authentication state directly from Firebase
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setAuthChecked(true);
      if (!firebaseUser) {
        setError("Please log in to view profiles");
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Only proceed if auth check has happened
        if (!authChecked) return;
        
        setIsLoading(true);
        
        // Get user ID (use the URL parameter if available, otherwise use the current user's ID)
        const targetUserId = username || auth.currentUser?.uid;
        
        if (!targetUserId) {
          throw new Error("No user ID available");
        }
        
        // Fetch the user document
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Set profile data
          setProfile({
            uid: userDoc.id,
            email: userData.email || null,
            displayName: userData.displayName || null,
            photoURL: userData.photoURL || null,
            createdAt: userData.createdAt || new Date(),
            handicapIndex: userData.handicapIndex || null,
            homeCourse: userData.homeCourse || null,
            profileComplete: userData.profileComplete || false,
            bio: userData.bio || null
          });
          
          // For demo purposes, set placeholder data
          // In a real implementation, you would fetch this from the database
          setFollowerCount(42);
          setFollowingCount(21);
          setPosts([]);
          setRounds([]);
          setAverageScore(78.5);
          setBestScore({
            score: 72,
            course: "Chambers Bay",
            date: "2024-03-15",
            par: 72
          });
          
          // Check if current user is following this profile
          setIsFollowing(false);
        } else {
          setError("User profile not found");
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfileData();
  }, [username, authChecked]);

  // Handle follow/unfollow
  const handleToggleFollow = () => {
    setIsFollowing(!isFollowing);
    setFollowerCount(prevCount => isFollowing ? prevCount - 1 : prevCount + 1);
    // In a real implementation, update the database
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading profile..." />
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
        isFollowing={isFollowing}
        followerCount={followerCount}
        followingCount={followingCount}
        onToggleFollow={handleToggleFollow}
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
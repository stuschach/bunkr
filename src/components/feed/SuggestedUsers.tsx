// src/components/feed/SuggestedUsers.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  collection, 
  query, 
  limit, 
  getDocs, 
  where, 
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { UserProfile } from '@/types/auth';
import { useFollow } from '@/lib/hooks/useFollow';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useNotifications } from '@/lib/contexts/NotificationContext'; // CORRECTED: Changed from useNotification to useNotifications

export function SuggestedUsers() {
  const { user } = useAuth();
  const { showNotification } = useNotifications(); // CORRECTED: Changed from useNotification to useNotifications
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestedUsers = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);
        
        // First, get users the current user is following
        const followingQuery = query(
          collection(db, 'users', user.uid, 'connections'),
          where('type', '==', 'following'),
          where('active', '==', true)
        );
        
        const followingSnapshot = await getDocs(followingQuery);
        
        // Extract the IDs of users being followed
        const followingIds = followingSnapshot.docs.map(doc => doc.data().userId);
        
        // Add current user's ID to exclude from suggestions
        const excludeIds = new Set([...followingIds, user.uid]);
        console.log('Excluding users:', [...excludeIds]);
        
        // Find mutual connections (users followed by people you follow)
        const mutualUsers = new Map<string, number>();
        
        // For each followed user, get their connections
        await Promise.all(followingIds.map(async (followedId) => {
          try {
            const theirConnectionsQuery = query(
              collection(db, 'users', followedId, 'connections'),
              where('type', '==', 'following'),
              where('active', '==', true)
            );
            
            const theirConnectionsSnapshot = await getDocs(theirConnectionsQuery);
            
            // Count each connection (for determining "strength" of mutual connection)
            theirConnectionsSnapshot.docs.forEach(doc => {
              const connectionId = doc.data().userId;
              
              // Skip users we're already following or ourselves
              if (!excludeIds.has(connectionId)) {
                const count = mutualUsers.get(connectionId) || 0;
                mutualUsers.set(connectionId, count + 1);
              }
            });
          } catch (error) {
            console.error('Error fetching connections for user:', followedId, error);
          }
        }));
        
        // Sort mutual connections by "strength" (number of mutual connections)
        const sortedMutualIds = Array.from(mutualUsers.entries())
          .sort((a, b) => b[1] - a[1])  // Sort by count (descending)
          .slice(0, 5)                   // Take top 5
          .map(entry => entry[0]);       // Extract just the user IDs
        
        console.log('Mutual connection user IDs:', sortedMutualIds);
        
        if (sortedMutualIds.length === 0) {
          // Fallback: get random users not being followed
          // Implement chunked queries if excludeIds is large
          await fetchRandomUsers(excludeIds);
          return;
        }
        
        // Fetch the full user profiles for mutual connections
        // Using direct document references for better reliability
        const userProfiles = await Promise.all(
          sortedMutualIds.slice(0, 3).map(async (userId) => {
            try {
              // Using direct document reference instead of a query
              const userDocRef = doc(db, 'users', userId);
              const userDocSnap = await getDoc(userDocRef);
              
              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                return {
                  uid: userId,
                  email: userData.email || null,
                  displayName: userData.displayName || null,
                  photoURL: userData.photoURL || null,
                  createdAt: userData.createdAt?.toDate() || new Date(),
                  handicapIndex: userData.handicapIndex || null,
                  homeCourse: userData.homeCourse || null,
                  profileComplete: userData.profileComplete || false,
                } as UserProfile;
              }
              return null;
            } catch (error) {
              console.error('Error fetching user profile:', userId, error);
              return null;
            }
          })
        );
        
        // Filter out any null results and set to state
        const validProfiles = userProfiles.filter(Boolean) as UserProfile[];
        console.log('Valid suggested user profiles:', validProfiles.length);
        setSuggestedUsers(validProfiles);
        
      } catch (error) {
        console.error('Error fetching suggested users:', error);
        setError('Failed to load suggested users');
        setSuggestedUsers([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to fetch random users when no mutual connections exist
    const fetchRandomUsers = async (excludeIds: Set<string>) => {
      try {
        const excludeArray = Array.from(excludeIds);
        
        // Firestore has a limit of 10 values for 'not-in' queries
        // If we have more than 10 excluded users, we need a different approach
        let randomUsers: UserProfile[] = [];
        
        if (excludeArray.length <= 10) {
          // Simple query if we have 10 or fewer excluded users
          const usersQuery = query(
            collection(db, 'users'),
            where('uid', 'not-in', excludeArray),
            limit(3)
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          randomUsers = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          } as UserProfile));
        } else {
          // Get more users and filter in memory
          const usersQuery = query(
            collection(db, 'users'),
            limit(20) // Get more users than we need
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          
          // Filter out excluded users
          randomUsers = usersSnapshot.docs
            .map(doc => ({
              uid: doc.id,
              ...doc.data()
            } as UserProfile))
            .filter(profile => !excludeIds.has(profile.uid))
            .slice(0, 3); // Take only 3
        }
        
        setSuggestedUsers(randomUsers);
      } catch (error) {
        console.error('Error fetching random users:', error);
        setSuggestedUsers([]);
      }
    };

    fetchSuggestedUsers();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Suggested For You</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-4">
          <LoadingSpinner size="sm" color="primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Suggested For You</CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm text-red-500 dark:text-red-400">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (suggestedUsers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Suggested For You</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {suggestedUsers.map((suggestedUser) => (
            <SuggestedUserItem 
              key={suggestedUser.uid} 
              user={suggestedUser} 
              onFollowChange={() => {
                // Refresh suggested users after follow/unfollow
                suggestedUsers.filter(u => u.uid !== suggestedUser.uid);
              }}
            />
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link href="/discover/golfers" className="text-sm text-green-500 hover:text-green-600">
            See More
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface SuggestedUserItemProps {
  user: UserProfile;
  onFollowChange?: () => void;
}

function SuggestedUserItem({ user, onFollowChange }: SuggestedUserItemProps) {
  const { 
    toggleFollow, 
    isLoading, 
    isFollowing,
    isHovered, 
    setIsHovered, 
    getButtonText, 
    getButtonVariant 
  } = useFollow({ 
    targetUserId: user.uid,
    onFollowChange
  });

  // Prevent showing "Following" button for suggested users
  // This is an additional check in case our filtering logic missed something
  if (isFollowing) {
    return null;
  }

  return (
    <div className="flex justify-between items-center">
      <Link href={`/profile/${user.uid}`} className="flex items-center">
        <Avatar
          src={user.photoURL}
          alt={user.displayName || 'User'}
          size="sm"
          className="mr-2"
        />
        <div>
          <div className="font-medium text-sm">
            {user.displayName}
            {user.handicapIndex !== undefined && user.handicapIndex !== null && (
              <Badge variant="outline" className="ml-1 text-xs">
                {formatHandicapIndex(user.handicapIndex)}
              </Badge>
            )}
          </div>
          {user.homeCourse && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user.homeCourse}
            </div>
          )}
        </div>
      </Link>
      <Button 
        size="sm" 
        variant={getButtonVariant()}
        onClick={async () => {
          await toggleFollow();
          if (onFollowChange) onFollowChange();
        }}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isLoading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading</span>
          </div>
        ) : (
          getButtonText()
        )}
      </Button>
    </div>
  );
}
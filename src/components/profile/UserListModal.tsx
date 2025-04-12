// src/components/profile/UserListModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useAuth } from '@/lib/contexts/AuthContext';
import { FollowButton } from '@/components/profile/FollowButton';
import { UserProfile } from '@/types/auth';
import { useFollowContext } from '@/lib/contexts/FollowContext';

// Helper function to get connection prefix for compound IDs
function getConnectionTypePrefix(connectionType: 'follower' | 'following'): string {
  return connectionType;
}

interface UserListModalProps {
  userId: string;
  type: 'followers' | 'following';
  isOpen: boolean;
  onClose: () => void;
}

export function UserListModal({
  userId,
  type,
  isOpen,
  onClose
}: UserListModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { refreshFollowState } = useFollowContext();

  // Fetch the initial batch of users
  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchUsers() {
      try {
        setIsLoading(true);
        setError(null);
        setUsers([]);
        setLastVisible(null);
        setHasMore(true);
        
        // Get the connections collection reference for the user
        const connectionsRef = collection(db, 'users', userId, 'connections');
        
        // Create the appropriate query based on type
        const connectionType = type === 'followers' ? 'follower' : 'following';
        
        // Query based on connection type field (still works with compound IDs)
        const connectionsQuery = query(
          connectionsRef,
          where('type', '==', connectionType),
          where('active', '==', true),
          limit(20)
        );
        
        const connectionsSnapshot = await getDocs(connectionsQuery);
        
        if (connectionsSnapshot.empty) {
          setUsers([]);
          setHasMore(false);
          setIsLoading(false);
          return;
        }
        
        // Set last visible for pagination
        setLastVisible(connectionsSnapshot.docs[connectionsSnapshot.docs.length - 1]);
        
        // Check if there are more items to load
        setHasMore(connectionsSnapshot.docs.length === 20);
        
        // For each connection, get the actual user profile
        const userProfiles = await Promise.all(
          connectionsSnapshot.docs.map(async (docSnapshot) => {
            const connectionData = docSnapshot.data();
            const connectedUserId = connectionData.userId;
            
            // Get the user document
            const userDoc = await getDoc(doc(db, 'users', connectedUserId));
            
            if (!userDoc.exists()) {
              return null;
            }
            
            const userData = userDoc.data();
            
            // Ensure the follow state is refreshed in context
            if (user && user.uid !== connectedUserId) {
              refreshFollowState(connectedUserId);
            }
            
            return {
              uid: userDoc.id,
              email: userData.email || null,
              displayName: userData.displayName || null,
              photoURL: userData.photoURL || null,
              createdAt: userData.createdAt?.toDate() || new Date(),
              handicapIndex: userData.handicapIndex || null,
              homeCourse: userData.homeCourse || null,
              profileComplete: userData.profileComplete || false,
              bio: userData.bio || null
            } as UserProfile;
          })
        );
        
        // Filter out any null values (users that might have been deleted)
        const filteredProfiles = userProfiles.filter(profile => profile !== null) as UserProfile[];
        
        setUsers(filteredProfiles);
      } catch (err) {
        console.error(`Error fetching ${type}:`, err);
        setError(`Failed to load ${type}. Please try again.`);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUsers();
  }, [isOpen, userId, type, user, refreshFollowState]);
  
  // Function to load more users
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !lastVisible) return;
    
    try {
      setIsLoadingMore(true);
      
      // Get the connections collection reference for the user
      const connectionsRef = collection(db, 'users', userId, 'connections');
      
      // Create the appropriate query based on type
      const connectionType = type === 'followers' ? 'follower' : 'following';
      
      // Query using connection type field and starting after last visible
      const connectionsQuery = query(
        connectionsRef,
        where('type', '==', connectionType),
        where('active', '==', true),
        startAfter(lastVisible),
        limit(20)
      );
      
      const connectionsSnapshot = await getDocs(connectionsQuery);
      
      if (connectionsSnapshot.empty) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }
      
      // Set last visible for pagination
      setLastVisible(connectionsSnapshot.docs[connectionsSnapshot.docs.length - 1]);
      
      // Check if there are more items to load
      setHasMore(connectionsSnapshot.docs.length === 20);
      
      // For each connection, get the actual user profile
      const userProfiles = await Promise.all(
        connectionsSnapshot.docs.map(async (docSnapshot) => {
          const connectionData = docSnapshot.data();
          const connectedUserId = connectionData.userId;
          
          // Get the user document
          const userDoc = await getDoc(doc(db, 'users', connectedUserId));
          
          if (!userDoc.exists()) {
            return null;
          }
          
          const userData = userDoc.data();
          
          // Ensure the follow state is refreshed in context
          if (user && user.uid !== connectedUserId) {
            refreshFollowState(connectedUserId);
          }
          
          return {
            uid: userDoc.id,
            email: userData.email || null,
            displayName: userData.displayName || null,
            photoURL: userData.photoURL || null,
            createdAt: userData.createdAt?.toDate() || new Date(),
            handicapIndex: userData.handicapIndex || null,
            homeCourse: userData.homeCourse || null,
            profileComplete: userData.profileComplete || false,
            bio: userData.bio || null
          } as UserProfile;
        })
      );
      
      // Filter out any null values (users that might have been deleted)
      const filteredProfiles = userProfiles.filter(profile => profile !== null) as UserProfile[];
      
      // Append to existing users
      setUsers(prev => [...prev, ...filteredProfiles]);
    } catch (err) {
      console.error(`Error fetching more ${type}:`, err);
      setError(`Failed to load more ${type}. Please try again.`);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // Function to handle follow state changes
  const handleFollowChange = (targetUserId: string, isFollowing: boolean) => {
    console.log(`[UserListModal] Follow state changed for ${targetUserId}: ${isFollowing}`);
    // No need for local state management - context handles it
  };
  
  // Function to navigate to user profile
  const navigateToProfile = (profileId: string) => {
    router.push(`/profile/${profileId}`);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <LoadingSpinner size="lg" color="primary" label={`Loading ${type}...`} />
            </div>
          ) : error ? (
            <div className="text-center p-4 text-red-500">
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2" 
                onClick={() => setError(null)}
              >
                Try Again
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              {type === 'followers' 
                ? 'This user doesn\'t have any followers yet.'
                : 'This user isn\'t following anyone yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(profile => (
                <Card key={profile.uid} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigateToProfile(profile.uid)}
                    >
                      <Avatar 
                        src={profile.photoURL} 
                        alt={profile.displayName || 'User'} 
                        size="md"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="font-medium truncate">{profile.displayName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {profile.handicapIndex !== null 
                            ? `Handicap: ${profile.handicapIndex.toFixed(1)}`
                            : profile.homeCourse 
                              ? `Home: ${profile.homeCourse}`
                              : `Joined: ${new Date(profile.createdAt).toLocaleDateString()}`
                          }
                        </div>
                      </div>
                    </div>
                    
                    {user && user.uid !== profile.uid && (
                      <div className="ml-2">
                        <FollowButton 
                          userId={profile.uid}
                          onFollowChange={(isFollowing) => handleFollowChange(profile.uid, isFollowing)}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              
              {hasMore && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    isLoading={isLoadingMore}
                    disabled={isLoadingMore}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
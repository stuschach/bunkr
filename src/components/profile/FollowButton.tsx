// src/components/profile/FollowButton.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotificationCreator } from '@/lib/hooks/useNotificationCreator';
import { 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  onCountChange?: (count: number) => void;
}

export function FollowButton({
  userId,
  isFollowing: initialIsFollowing,
  onFollowChange,
  onCountChange
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { notifyFollow } = useNotificationCreator();

  // Simplified follow toggle function with explicit alerts for debugging
  const handleFollowToggle = async () => {
    if (!user) {
      alert('You must be logged in to follow users');
      return;
    }
    
    if (user.uid === userId) {
      alert('You cannot follow yourself');
      return;
    }

    setIsLoading(true);
    console.log(`Starting follow toggle. Current state: ${isFollowing}`);

    try {
      // The new follow state will be the opposite of the current state
      const newFollowState = !isFollowing;
      
      // Document references
      const followingDocRef = doc(db, 'users', user.uid, 'connections', userId);
      const followerDocRef = doc(db, 'users', userId, 'connections', user.uid);
      const userDocRef = doc(db, 'users', userId);
      const currentUserDocRef = doc(db, 'users', user.uid);
      
      console.log('Created document references');
      
      // First, update the connection documents
      if (newFollowState) {
        console.log('Following user - Creating connection documents');
        
        // Create following document
        await setDoc(followingDocRef, {
          userId: userId,
          type: 'following',
          active: true,
          createdAt: serverTimestamp()
        });
        console.log('✓ Created following document');
        
        // Create follower document
        await setDoc(followerDocRef, {
          userId: user.uid,
          type: 'follower',
          active: true,
          createdAt: serverTimestamp()
        });
        console.log('✓ Created follower document');
        
        // Update counts
        await updateDoc(userDocRef, {
          followerCount: increment(1)
        });
        console.log('✓ Updated follower count');
        
        await updateDoc(currentUserDocRef, {
          followingCount: increment(1)
        });
        console.log('✓ Updated following count');
        
        // Send notification
        try {
          const notificationId = await notifyFollow(userId);
          console.log(`✓ Sent notification: ${notificationId}`);
        } catch (notifyError) {
          console.error('Error sending notification:', notifyError);
          // Continue even if notification fails
        }
        
        alert('Successfully followed user');
      } else {
        console.log('Unfollowing user - Updating connection documents');
        
        // Update following document
        await setDoc(followingDocRef, {
          userId: userId,
          type: 'following',
          active: false,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✓ Updated following document');
        
        // Update follower document
        await setDoc(followerDocRef, {
          userId: user.uid,
          type: 'follower',
          active: false,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✓ Updated follower document');
        
        // Update counts
        // Get current counts first to avoid negative values
        const userDoc = await getDoc(userDocRef);
        const currentUserDoc = await getDoc(currentUserDocRef);
        
        const currentFollowerCount = userDoc.exists() ? (userDoc.data().followerCount || 0) : 0;
        const currentFollowingCount = currentUserDoc.exists() ? (currentUserDoc.data().followingCount || 0) : 0;
        
        await updateDoc(userDocRef, {
          followerCount: Math.max(currentFollowerCount - 1, 0)
        });
        console.log('✓ Updated follower count');
        
        await updateDoc(currentUserDocRef, {
          followingCount: Math.max(currentFollowingCount - 1, 0)
        });
        console.log('✓ Updated following count');
        
        alert('Successfully unfollowed user');
      }
      
      // Update local state
      console.log(`Updating UI state to ${newFollowState}`);
      setIsFollowing(newFollowState);
      
      // Notify parent component
      if (onFollowChange) {
        onFollowChange(newFollowState);
      }
      
      // Get updated follower count
      const updatedUserDoc = await getDoc(userDocRef);
      const newCount = updatedUserDoc.exists() ? (updatedUserDoc.data().followerCount || 0) : 0;
      console.log(`Updated follower count is now ${newCount}`);
      
      if (onCountChange) {
        onCountChange(newCount);
      }
      
    } catch (error) {
      console.error('Error toggling follow status:', error);
      // Show explicit error message to help diagnose the issue
      alert(`Failed to update follow status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : 'primary'}
      onClick={handleFollowToggle}
      isLoading={isLoading}
      disabled={isLoading || (user && user.uid === userId)} // Disable for your own profile
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}
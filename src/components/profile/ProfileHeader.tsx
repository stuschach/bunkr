// src/components/profile/ProfileHeader.tsx
'use client';

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProfileImageUploader } from '@/components/profile/ProfileImageUploader';
import { ImageUploader } from '@/components/common/media/ImageUploader';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { useMessages } from '@/lib/hooks/useMessages';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { UserProfile } from '@/types/auth';
import { FollowButton } from '@/components/profile/FollowButton';
import { QuickMessageModal } from '@/components/profile/QuickMessageModal';
import { UserListModal } from '@/components/profile/UserListModal';
import { useFollowContext } from '@/lib/contexts/FollowContext';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  onFollowerCountChange?: (count: number) => void;
}

// Use memo to prevent unnecessary re-renders
export const ProfileHeader = memo(function ProfileHeader({
  profile,
  isOwnProfile,
  onFollowChange,
  onFollowerCountChange,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [isQuickMessageOpen, setIsQuickMessageOpen] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const { getOrCreateChat } = useMessages();
  const { showNotification } = useNotifications();
  const { getFollowerCount, getFollowingCount, isFollowing, refreshFollowState } = useFollowContext();
  
  // Ensure we have the latest follow data
  useEffect(() => {
    if (!isOwnProfile && profile?.uid && auth.currentUser) {
      refreshFollowState(profile.uid);
    }
  }, [isOwnProfile, profile?.uid, refreshFollowState]);
  
  // Get the current follower and following counts from context
  const followerCount = profile?.uid ? getFollowerCount(profile.uid) : 0;
  const followingCount = profile?.uid ? getFollowingCount(profile.uid) : 0;
  const userIsFollowing = profile?.uid ? isFollowing(profile.uid) : false;
  
  // Memoize expensive computations
  const getUserAchievements = useCallback(() => {
    const achievements = [];
    
    // Handicap-based achievements
    if (profile.handicapIndex !== null) {
      if (profile.handicapIndex < 5) {
        achievements.push({ name: 'Scratch Golfer', icon: '🏆' });
      } else if (profile.handicapIndex < 10) {
        achievements.push({ name: 'Single Digit', icon: '⛳' });
      } else if (profile.handicapIndex < 15) {
        achievements.push({ name: 'Competitor', icon: '🏌️' });
      }
    }
    
    // Social achievements
    if (followerCount > 100) {
      achievements.push({ name: 'Influencer', icon: '🌟' });
    } else if (followerCount > 50) {
      achievements.push({ name: 'Popular', icon: '👥' });
    }
    
    return achievements;
  }, [profile.handicapIndex, followerCount]);

  // Memoize the achievements calculation
  const achievements = useMemo(() => getUserAchievements(), [getUserAchievements]);

  // Handle image uploads with useCallback
  const handleImageUploaded = useCallback(async (url: string) => {
    try {
      // Update user document in Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          photoURL: url
        });
      }
      
      // Close uploader
      setIsUploadingImage(false);
      
      // Show success message
      showNotification({
        type: 'success',
        title: 'Profile Updated',
        description: 'Profile picture updated successfully!'
      });
      
      // Reload page to show new image
      router.refresh();
    } catch (error) {
      console.error('Error updating profile picture:', error);
      showNotification({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update profile. Please try again.'
      });
    }
  }, [showNotification, router]);

  const handleCoverPhotoUploaded = useCallback(async (url: string) => {
    try {
      // Update user document in Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          coverPhotoURL: url
        });
      }
      
      // Close uploader
      setIsUploadingCover(false);
      
      // Show success message
      showNotification({
        type: 'success',
        title: 'Cover Updated',
        description: 'Cover photo updated successfully!'
      });
      
      // Reload page to show new image
      router.refresh();
    } catch (error) {
      console.error('Error updating cover photo:', error);
      showNotification({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update cover photo. Please try again.'
      });
    }
  }, [showNotification, router]);

  // Handle follower count changes
  const handleFollowerCountChange = useCallback((newCount: number) => {
    console.log(`[ProfileHeader] Follower count changed to: ${newCount}`);
    
    // Notify parent component
    if (onFollowerCountChange) {
      onFollowerCountChange(newCount);
    }
  }, [onFollowerCountChange]);

  const handleOpenChat = useCallback(async () => {
    if (!auth.currentUser) {
      showNotification({
        type: 'info',
        title: 'Sign in required',
        description: 'Please sign in to message users',
      });
      return;
    }

    setIsMessaging(true);

    try {
      const chat = await getOrCreateChat(profile.uid);
      router.push(`/messages?chat=${chat.id}`);
    } catch (error) {
      console.error('Error creating chat:', error);
      showNotification({
        type: 'error',
        title: 'Message Failed',
        description: 'Unable to create conversation. Please try again.',
      });
    } finally {
      setIsMessaging(false);
    }
  }, [profile.uid, getOrCreateChat, router, showNotification]);

  const handleQuickMessage = useCallback(() => {
    setIsQuickMessageOpen(true);
  }, []);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
      {/* Cover Photo Area with optimized image loading */}
      <div className="h-32 md:h-48 bg-gradient-to-r from-green-400 to-blue-500 relative">
        {profile.coverPhotoURL && (
          <img 
            src={profile.coverPhotoURL} 
            alt="Cover photo" 
            className="w-full h-full object-cover"
            loading="lazy" 
            sizes="(max-width: 768px) 100vw, 768px"
          />
        )}
        {isOwnProfile && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 opacity-90 hover:opacity-100"
            onClick={() => setIsUploadingCover(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Update Cover
          </Button>
        )}
      </div>

      {/* Profile Content */}
      <div className="px-4 py-6 md:px-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar - Positioned to overlap with cover photo */}
          <div className="flex-shrink-0 -mt-16 md:-mt-20 z-10 flex justify-center md:justify-start">
            <div className="relative">
              <Avatar 
                src={profile.photoURL} 
                alt={profile.displayName || 'User'} 
                size="xl"
                className="h-28 w-28 md:h-36 md:w-36 border-4 border-white dark:border-gray-800 shadow-lg" 
                loading="lazy"
              />
              {isOwnProfile && (
                <Button
                  variant="primary"
                  size="sm"
                  className="absolute bottom-1 right-1 rounded-full w-8 h-8 p-0 flex items-center justify-center"
                  onClick={() => setIsUploadingImage(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="M12 11v6" />
                    <path d="M9 14h6" />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-grow pt-4 md:pt-0">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                  <div className="flex gap-1">
                    {achievements.map((achievement, index) => (
                      <div 
                        key={index} 
                        className="text-lg" 
                        title={achievement.name}
                      >
                        {achievement.icon}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 my-2">
                  {profile.handicapIndex !== null && (
                    <Badge 
                      variant="outline" 
                      className="font-semibold bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                    >
                      Handicap: {formatHandicapIndex(profile.handicapIndex)}
                    </Badge>
                  )}
                  {profile.homeCourse && (
                    <Badge variant="secondary">
                      Home: {profile.homeCourse}
                    </Badge>
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-gray-700 dark:text-gray-300 mt-2 mb-3 max-w-2xl">{profile.bio}</p>
                )}

                {/* Follower Stats - Interactive with Modal */}
                <div className="flex gap-6 mt-2 mb-1">
                  <button 
                    className="text-sm hover:underline"
                    onClick={() => setShowFollowersModal(true)}
                    data-testid="followers-count"
                  >
                    <span className="font-semibold">{followerCount}</span> Followers
                  </button>
                  <button 
                    className="text-sm hover:underline"
                    onClick={() => setShowFollowingModal(true)}
                  >
                    <span className="font-semibold">{followingCount}</span> Following
                  </button>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 mt-2 md:mt-0">
                {isOwnProfile ? (
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/profile/edit')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    {/* Use the improved FollowButton implementation */}
                    <FollowButton 
                      userId={profile.uid}
                      onFollowChange={onFollowChange}
                      onCountChange={handleFollowerCountChange}
                      size="md"
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleOpenChat}
                        isLoading={isMessaging}
                        disabled={isMessaging}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-2"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Message
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={handleQuickMessage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Upload Modal */}
      {isUploadingImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Update Profile Picture</h3>
            
            <ProfileImageUploader
              userId={profile.uid}
              onImageUploaded={handleImageUploaded}
              onCancel={() => setIsUploadingImage(false)}
              currentImage={profile.photoURL}
            />
          </div>
        </div>
      )}

      {/* Cover Photo Upload Modal */}
      {isUploadingCover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Update Cover Photo</h3>
            
            <ImageUploader
              userId={profile.uid}
              onImageUploaded={handleCoverPhotoUploaded}
              folder="covers"
              aspectRatio="16:9"
              variant="cover"
              initialImage={profile.coverPhotoURL}
              className="w-full"
            />
            
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsUploadingCover(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Message Modal */}
      {isQuickMessageOpen && (
        <QuickMessageModal
          recipientId={profile.uid}
          recipientName={profile.displayName || 'User'}
          onClose={() => setIsQuickMessageOpen(false)}
        />
      )}

      {/* Followers Modal */}
      <UserListModal
        userId={profile.uid}
        type="followers"
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
      />

      {/* Following Modal */}
      <UserListModal
        userId={profile.uid}
        type="following"
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
      />
    </div>
  );
});
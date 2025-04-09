// src/components/profile/ProfileHeader.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProfileImageUploader } from '@/components/profile/ProfileImageUploader';
import { formatHandicapIndex } from '@/lib/utils/formatting';
import { UserProfile } from '@/types/auth';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  isFollowing?: boolean;
  followerCount: number;
  followingCount: number;
  onToggleFollow?: () => void;
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing = false,
  followerCount,
  followingCount,
  onToggleFollow,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUploaded = async (url: string) => {
    try {
      // Update user document in Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          photoURL: url
        });
        console.log('Profile image updated in database');
      }
      
      // Close uploader
      setIsUploadingImage(false);
      
      // Show success message
      alert('Profile picture updated successfully!');
      
      // Reload page to show new image - this should use Next.js router instead
      router.refresh();
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-950 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isOwnProfile ? (
            <div className="relative">
              <Avatar 
                src={profile.photoURL} 
                alt={profile.displayName || 'User'} 
                size="xl"
                className="h-24 w-24 md:h-32 md:w-32" 
              />
              <Button
                variant="primary"
                size="sm"
                className="absolute bottom-0 right-0 rounded-full p-1"
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
            </div>
          ) : (
            <Avatar 
              src={profile.photoURL} 
              alt={profile.displayName || 'User'} 
              size="xl"
              className="h-24 w-24 md:h-32 md:w-32"
            />
          )}
        </div>

        {/* User Info */}
        <div className="flex-grow">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">{profile.displayName}</h1>
              <div className="flex items-center gap-2 mb-2">
                {profile.handicapIndex !== null && (
                  <Badge variant="outline" className="font-semibold">
                    Handicap: {formatHandicapIndex(profile.handicapIndex)}
                  </Badge>
                )}
                {profile.homeCourse && (
                  <Badge variant="secondary">
                    Home: {profile.homeCourse}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Member since {new Date(profile.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/profile/edit')}
                >
                  Edit Profile
                </Button>
              ) : (
                <Button 
                  variant={isFollowing ? "outline" : "primary"}
                  onClick={onToggleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-gray-700 dark:text-gray-300">{profile.bio}</p>
          )}

          {/* Follower Stats */}
          <div className="flex gap-4 mt-4">
            <div className="text-sm">
              <span className="font-semibold">{followerCount}</span> Followers
            </div>
            <div className="text-sm">
              <span className="font-semibold">{followingCount}</span> Following
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
    </div>
  );
}
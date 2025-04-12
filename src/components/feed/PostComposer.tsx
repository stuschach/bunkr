// src/components/feed/PostComposer.tsx
// Modified to use the new usePostCreation hook and support feed refresh

import React, { useState, useRef, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Media } from '@/types/post';
import { UserProfile } from '@/types/auth';
import { usePostCreation } from '@/lib/hooks/usePostCreation';

interface PostComposerProps {
  user: UserProfile;
  onPostCreated?: () => void; // Add callback for refreshing feed
}

export function PostComposer({ user, onPostCreated }: PostComposerProps) {
  const [postText, setPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const { createPost, isCreating } = usePostCreation();

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPostText(e.target.value);
  };

  // Handle media selection
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    // Create preview URLs for each selected file
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        newFiles.push(file);
        newPreviewUrls.push(URL.createObjectURL(file));
      }
    });

    setMediaFiles(prevFiles => [...prevFiles, ...newFiles]);
    setMediaPreviewUrls(prevUrls => [...prevUrls, ...newPreviewUrls]);
  };

  // Remove a media item
  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviewUrls[index]);
    setMediaFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    setMediaPreviewUrls(prevUrls => prevUrls.filter((_, i) => i !== index));
  };

  // Handle post submission
  const handleSubmit = async () => {
    if (!postText.trim() && mediaFiles.length === 0) return;

    try {
      // Upload media files if any
      const mediaItems: Media[] = [];

      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const mediaId = Date.now().toString() + Math.random().toString(36).substring(2);
          const fileExtension = file.name.split('.').pop() || 'jpg';
          const filePath = `users/${user.uid}/posts/${mediaId}.${fileExtension}`;
          const storageRef = ref(storage, filePath);
          
          // Upload file
          const uploadTask = await uploadBytesResumable(storageRef, file);
          const downloadUrl = await getDownloadURL(uploadTask.ref);
          
          // Determine media type
          const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
          
          mediaItems.push({
            id: mediaId,
            type: mediaType,
            url: downloadUrl
          });
        }
      }

      // Extract hashtags from post text
      const hashtagRegex = /#(\w+)/g;
      const hashtags: string[] = [];
      let match: RegExpExecArray | null;
      
      while ((match = hashtagRegex.exec(postText)) !== null) {
        hashtags.push(match[1].toLowerCase());
      }

      // Use the new createPost hook function
      await createPost({
        content: postText,
        media: mediaItems,
        visibility: 'public',
        hashtags
      }, 'regular');

      // Reset form
      setPostText('');
      setMediaFiles([]);
      setMediaPreviewUrls([]);
      
      // Call the onPostCreated callback to refresh the feed
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error) {
      console.error('Error creating post:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to create post. Please try again.'
      });
    }
  };

  // Handle group creation button click
  const handleCreateGroup = () => {
    // Navigate to create group page
    window.location.href = '/groups/create';
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            size="md" 
          />
          <div className="flex-grow">
            <textarea
              placeholder="What's on your mind?"
              value={postText}
              onChange={handleTextChange}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={2}
              disabled={isCreating}
            />
            
            {/* Media preview section */}
            {mediaPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {mediaPreviewUrls.map((url, index) => (
                  <div key={index} className="relative rounded-md overflow-hidden h-24">
                    {mediaFiles[index].type.startsWith('image/') ? (
                      <img 
                        src={url} 
                        alt="Media preview" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <video 
                        src={url} 
                        className="w-full h-full object-cover" 
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white"
                      onClick={() => removeMedia(index)}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M6 18L18 6M6 6l12 12" 
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex flex-wrap justify-between items-center mt-3">
              <div className="flex space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaSelect}
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  disabled={isCreating}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5 mr-1" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                  Photos/Videos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCreateGroup}
                  disabled={isCreating}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5 mr-1" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
                    />
                  </svg>
                  Create Group
                </Button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={(!postText.trim() && mediaFiles.length === 0) || isCreating}
                isLoading={isCreating}
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
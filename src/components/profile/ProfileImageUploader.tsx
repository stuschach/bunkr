// src/components/profile/ProfileImageUploader.tsx
'use client';

import React, { useState, useRef } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface ProfileImageUploaderProps {
  userId: string;
  onImageUploaded: (url: string) => void;
  onCancel: () => void;
  currentImage?: string | null;
}

export function ProfileImageUploader({
  userId,
  onImageUploaded,
  onCancel,
  currentImage
}: ProfileImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large (max 5MB)');
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setError(null);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Please select an image first');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Create storage reference
      const storageRef = ref(storage, `users/${userId}/profile/${Date.now()}-${file.name}`);
      
      // Upload file
      const uploadResult = await uploadBytes(storageRef, file);
      console.log('File uploaded successfully', uploadResult);
      
      // Get download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      console.log('Download URL:', downloadUrl);
      
      // Call callback with URL
      onImageUploaded(downloadUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-center mb-6">
        <div className="relative w-32 h-32">
          {preview ? (
            <img 
              src={preview} 
              alt="Profile preview" 
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg 
                className="w-12 h-12 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex justify-center mb-2">
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={isUploading}
          >
            Select Image
          </Button>
        </div>
        
        {error && (
          <p className="text-sm text-red-500 text-center mb-2">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleUpload}
          disabled={!preview || isUploading}
          isLoading={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Save Image'}
        </Button>
      </div>
    </div>
  );
}
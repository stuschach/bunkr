'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { uploadFile } from '@/lib/firebase/storage';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  folder?: string;
  userId: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | 'free';
  maxSizeInMB?: number;
  className?: string;
  variant?: 'default' | 'avatar' | 'cover';
  initialImage?: string | null;
}

export function ImageUploader({
  onImageUploaded,
  folder = 'images',
  userId,
  aspectRatio = 'free',
  maxSizeInMB = 5,
  className,
  variant = 'default',
  initialImage = null,
}: ImageUploaderProps) {
  const [image, setImage] = useState<string | null>(initialImage);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClasses = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '4:3': 'aspect-4/3',
    'free': '',
  };

  const variantClasses = {
    default: 'rounded-md',
    avatar: 'rounded-full',
    cover: 'rounded-md',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeInMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeInMB}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Create a temporary local URL for preview
      const localUrl = URL.createObjectURL(file);
      setImage(localUrl);

      // Upload to Firebase Storage
      const filePath = `users/${userId}/${folder}/${Date.now()}-${file.name}`;
      const downloadUrl = await uploadFile(filePath, file);

      // Revoke temporary URL to prevent memory leaks
      URL.revokeObjectURL(localUrl);

      // Set the final image URL from Firebase
      setImage(downloadUrl);
      onImageUploaded(downloadUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
      setImage(initialImage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div 
        className={cn(
          'relative border-2 border-dashed border-gray-300 dark:border-gray-700',
          'bg-gray-50 dark:bg-gray-900/50 flex justify-center items-center overflow-hidden',
          aspectRatioClasses[aspectRatio],
          variantClasses[variant],
          {
            'hover:border-green-fairway cursor-pointer': !isUploading,
            'opacity-75': isUploading,
          }
        )}
        onClick={isUploading ? undefined : handleClickUpload}
      >
        {isUploading ? (
          <LoadingSpinner size="md" color="primary" label="Uploading..." />
        ) : image ? (
          <>
            <img 
              src={image} 
              alt="Uploaded image" 
              className={cn(
                'w-full h-full object-cover',
                variantClasses[variant]
              )} 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-center items-center text-white">
              <p className="text-sm font-medium mb-2">Click to change</p>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="bg-white/20 border-white text-white hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  setImage(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center p-6">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Click to upload an image
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              PNG, JPG, GIF up to {maxSizeInMB}MB
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
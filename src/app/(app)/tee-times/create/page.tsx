// src/app/(app)/tee-times/create/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeForm } from '@/components/tee-times/TeeTimeForm';
import { Heading, Text } from '@/components/ui/Typography';
import { TeeTimeFormData } from '@/types/tee-times';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export default function CreateTeeTimes() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { error, isLoading, createTeeTime } = useTeeTime();
  const [formError, setFormError] = useState<string | null>(null);
  
  // Handle form submission
  const handleSubmit = async (data: TeeTimeFormData) => {
    setFormError(null);
    
    try {
      // Use the useTeeTime hook which now internally uses usePostCreation
      const teeTimeId = await createTeeTime(data);
      
      if (teeTimeId) {
        router.push(`/tee-times/${teeTimeId}`);
      } else {
        setFormError('Failed to create tee time. Please try again.');
      }
    } catch (error) {
      console.error('Error creating tee time:', error);
      setFormError('An unexpected error occurred. Please try again.');
    }
  };
  
  // Check if user is authenticated
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }
  
  if (!user) {
    // Handle not logged in state - in practice, the AppLayout should handle this
    router.push('/login?returnUrl=/tee-times/create');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Heading level={2} className="mb-2">Create Group Tee Time</Heading>
        <Text className="text-gray-500 dark:text-gray-400">
          Schedule a tee time and invite others to join your group
        </Text>
      </div>
      
      {formError && (
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-md mb-6">
          <Text className="text-red-600 dark:text-red-400">{formError}</Text>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-md mb-6">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
        </div>
      )}
      
      <TeeTimeForm
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
      />
    </div>
  );
}
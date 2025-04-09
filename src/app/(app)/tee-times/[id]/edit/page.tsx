// src/app/(app)/tee-times/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeForm } from '@/components/tee-times/TeeTimeForm';
import { Heading, Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeTimeFormData } from '@/types/tee-times';

export default function EditTeeTime() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { error, isLoading, getTeeTimeById, updateTeeTime } = useTeeTime();
  
  // State
  const [formData, setFormData] = useState<TeeTimeFormData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingTeeTime, setLoadingTeeTime] = useState(true);
  
  // Get the tee time ID from params
  const teeTimeId = params.id as string;
  
  // Load tee time data
  useEffect(() => {
    const loadTeeTime = async () => {
      setLoadingTeeTime(true);
      
      try {
        const teeTime = await getTeeTimeById(teeTimeId);
        
        if (!teeTime) {
          setFormError('Tee time not found');
          return;
        }
        
        // Check if user is the creator
        if (user && teeTime.creatorId !== user.uid) {
          setFormError('You do not have permission to edit this tee time');
          return;
        }
        
        // Convert to form data
        const dateTime = new Date(teeTime.dateTime as Date);
        const hours = dateTime.getHours().toString().padStart(2, '0');
        const minutes = dateTime.getMinutes().toString().padStart(2, '0');
        
        setFormData({
          courseName: teeTime.courseName,
          courseId: teeTime.courseId,
          date: dateTime,
          time: `${hours}:${minutes}`,
          maxPlayers: teeTime.maxPlayers,
          visibility: teeTime.visibility,
          description: teeTime.description || '',
        });
      } catch (error) {
        console.error('Error loading tee time:', error);
        setFormError('Failed to load tee time details');
      } finally {
        setLoadingTeeTime(false);
      }
    };
    
    if (user) {
      loadTeeTime();
    }
  }, [teeTimeId, user, getTeeTimeById]);
  
  // Handle form submission
  const handleSubmit = async (data: TeeTimeFormData) => {
    setFormError(null);
    
    try {
      const success = await updateTeeTime(teeTimeId, data);
      
      if (success) {
        router.push(`/tee-times/${teeTimeId}`);
      } else {
        setFormError('Failed to update tee time. Please try again.');
      }
    } catch (error) {
      console.error('Error updating tee time:', error);
      setFormError('An unexpected error occurred. Please try again.');
    }
  };
  
  // Check if user is authenticated
  if (authLoading || loadingTeeTime) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }
  
  if (!user) {
    // Handle not logged in state - in practice, the AppLayout should handle this
    router.push(`/login?returnUrl=/tee-times/${teeTimeId}/edit`);
    return null;
  }
  
  if (formError) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-lg text-center">
          <Heading level={3} className="text-red-600 dark:text-red-400 mb-4">
            {formError}
          </Heading>
          <Button onClick={() => router.push(`/tee-times/${teeTimeId}`)}>
            Back to Tee Time
          </Button>
        </div>
      </div>
    );
  }
  
  if (!formData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-6 rounded-lg text-center">
          <Heading level={3} className="text-yellow-600 dark:text-yellow-400 mb-4">
            No tee time data available
          </Heading>
          <Button onClick={() => router.push(`/tee-times/${teeTimeId}`)}>
            Back to Tee Time
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Heading level={2} className="mb-2">Edit Tee Time</Heading>
        <Text className="text-gray-500 dark:text-gray-400">
          Update the details of your group tee time
        </Text>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-md mb-6">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
        </div>
      )}
      
      <TeeTimeForm
        initialData={formData}
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
        isEditing={true}
      />
    </div>
  );
}
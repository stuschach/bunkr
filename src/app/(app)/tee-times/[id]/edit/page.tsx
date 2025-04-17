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
import { Card, CardContent } from '@/components/ui/Card';
import { TeeTimeFormData } from '@/types/tee-times';

export default function EditTeeTime() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isLoading, error, getTeeTimeDetails, subscribeTeeTime } = useTeeTime();
  
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
        const { teeTime } = await getTeeTimeDetails(teeTimeId);
        
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
      
      // Subscribe to real-time updates
      const unsubscribe = subscribeTeeTime(teeTimeId, (teeTime) => {
        if (teeTime) {
          // If the tee time is updated while editing, refresh the form data
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
        }
      });
      
      return () => unsubscribe();
    }
  }, [teeTimeId, user, getTeeTimeDetails, subscribeTeeTime]);
  
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
        <Card className="mb-6 border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-6 text-center">
            <Heading level={3} className="text-red-600 dark:text-red-400 mb-4">{formError}</Heading>
            <Button onClick={() => router.push(`/tee-times/${teeTimeId}`)}>
              Back to Tee Time
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!formData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6 border-yellow-300 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="p-6 text-center">
            <Heading level={3} className="text-yellow-600 dark:text-yellow-400 mb-4">
              No tee time data available
            </Heading>
            <Button onClick={() => router.push(`/tee-times/${teeTimeId}`)}>
              Back to Tee Time
            </Button>
          </CardContent>
        </Card>
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
        <Card className="mb-6 border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <Text className="text-red-600 dark:text-red-400 font-medium">
              {error instanceof Error ? error.message : String(error)}
            </Text>
          </CardContent>
        </Card>
      )}
      
      <TeeTimeForm
        initialData={formData}
        autoSubmit={true}
        isSubmitting={isLoading}
        isEditing={true}
      />
    </div>
  );
}
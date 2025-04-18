// src/app/(app)/tee-times/create/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { TeeTimeForm } from '@/components/tee-times/TeeTimeForm';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/Card';

export default function CreateTeeTimes() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isLoading, error, createTeeTime } = useTeeTime();
  const [formError, setFormError] = useState<string | null>(null);
  
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
        <Card className="mb-6 border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <Text className="text-red-600 dark:text-red-400 font-medium">{formError}</Text>
          </CardContent>
        </Card>
      )}
      
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
        autoSubmit={true}
        isSubmitting={isLoading}
      />
    </div>
  );
}
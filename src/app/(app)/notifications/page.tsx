// src/app/(app)/notifications/page.tsx
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { NotificationList } from '@/components/notifications/NotificationList';
import { Heading, Text } from '@/components/ui/Typography';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?returnUrl=/notifications');
    }
  }, [user, loading, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }

  // Redirect handled in useEffect
  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Heading level={2} className="mb-2">Notifications</Heading>
        <Text className="text-gray-500 dark:text-gray-400">
          Stay updated on likes, comments, follows, and other activities
        </Text>
      </div>

      <NotificationList />
    </div>
  );
}
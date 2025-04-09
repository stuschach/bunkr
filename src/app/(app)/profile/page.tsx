// src/app/(app)/profile/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export default function ProfileIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // Redirect to the current user's profile
      router.push(`/profile/${user.uid}`);
    } else if (!loading && !user) {
      // Redirect to login if not authenticated
      router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex justify-center items-center min-h-[80vh]">
      <LoadingSpinner size="lg" color="primary" label="Loading profile..." />
    </div>
  );
}
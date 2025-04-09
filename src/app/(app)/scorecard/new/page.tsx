// src/app/(app)/scorecard/new/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

import { ScorecardForm } from '@/components/scorecard/ScorecardForm';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export default function NewScorecardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }

  if (!user) {
    router.push('/login?returnUrl=/scorecard/new');
    return null;
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Add New Round</h1>
        <Button
          variant="outline"
          onClick={() => router.push('/scorecard')}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 19l-7-7m0 0l7-7m-7 7h18" 
            />
          </svg>
          Cancel
        </Button>
      </div>

      <ScorecardForm />
    </div>
  );
}
// src/app/(app)/scorecard/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';

import { ScorecardForm } from '@/components/scorecard/ScorecardForm';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Scorecard } from '@/types/scorecard';

export default function EditScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showNotification } = useNotification();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scorecardId = params.id as string;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(`/login?returnUrl=/scorecard/${scorecardId}/edit`);
      return;
    }

    const loadScorecard = async () => {
      try {
        setIsLoading(true);
        
        const scorecardRef = doc(db, 'scorecards', scorecardId);
        const scorecardSnap = await getDoc(scorecardRef);
        
        if (scorecardSnap.exists()) {
          const data = scorecardSnap.data() as Omit<Scorecard, 'id'>;
          
          // Security check - users can only edit their own scorecards
          if (data.userId === user.uid) {
            setScorecard({
              id: scorecardId,
              ...data
            });
          } else {
            setError('You do not have permission to edit this scorecard');
          }
        } else {
          setError('Scorecard not found');
        }
      } catch (err) {
        console.error('Error loading scorecard:', err);
        setError('Failed to load scorecard');
      } finally {
        setIsLoading(false);
      }
    };

    loadScorecard();
  }, [scorecardId, user, loading, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading scorecard..." />
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
            {error || 'Failed to load scorecard'}
          </h2>
          <Button onClick={() => router.push('/scorecard')}>
            Back to Scorecards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Round</h1>
        <Button
          variant="outline"
          onClick={() => router.push(`/scorecard/${scorecardId}`)}
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

      <ScorecardForm 
        scorecardId={scorecardId}
        initialData={scorecard}
      />
    </div>
  );
}
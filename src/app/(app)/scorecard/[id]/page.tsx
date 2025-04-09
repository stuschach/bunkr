// src/app/(app)/scorecard/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';

import { ScorecardSummary } from '@/components/scorecard/ScorecardSummary';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Scorecard } from '@/types/scorecard';

export default function ScorecardDetailPage() {
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
      router.push(`/login?returnUrl=/scorecard/${scorecardId}`);
      return;
    }

    const loadScorecard = async () => {
      try {
        setIsLoading(true);
        
        const scorecardRef = doc(db, 'scorecards', scorecardId);
        const scorecardSnap = await getDoc(scorecardRef);
        
        if (scorecardSnap.exists()) {
          const data = scorecardSnap.data() as Omit<Scorecard, 'id'>;
          
          // Security check - users can only view their own scorecards or public ones
          if (data.userId === user.uid || data.isPublic) {
            setScorecard({
              id: scorecardId,
              ...data
            });
          } else {
            setError('You do not have permission to view this scorecard');
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

  const handleDeleteScorecard = async () => {
    if (!window.confirm('Are you sure you want to delete this scorecard? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'scorecards', scorecardId));
      
      showNotification({
        type: 'success',
        title: 'Scorecard deleted',
        description: 'Your scorecard has been deleted successfully'
      });
      
      router.push('/scorecard');
    } catch (err) {
      console.error('Error deleting scorecard:', err);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to delete scorecard'
      });
    }
  };

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

  const isOwner = user?.uid === scorecard.userId;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
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
          Back to Rounds
        </Button>

        {isOwner && (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/scorecard/${scorecardId}/edit`)}
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
                />
              </svg>
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={handleDeleteScorecard}
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                />
              </svg>
              Delete
            </Button>
          </div>
        )}
      </div>

      <ScorecardSummary scorecard={scorecard} showActions={true} />
    </div>
  );
}
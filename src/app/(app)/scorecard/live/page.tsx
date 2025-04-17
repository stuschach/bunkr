// src/app/(app)/scorecard/live/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

import { LiveScorecard } from '@/components/scorecard/LiveScoring/LiveScorecard';
import { CourseSelector } from '@/components/scorecard/CourseSelector';
import { TeeSelector } from '@/components/scorecard/TeeSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeBox } from '@/types/scorecard';

export default function LiveScoringPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scorecardId = searchParams ? searchParams.get('id') : null;
  const { user, loading } = useAuth();
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(false);
  const [initialData, setInitialData] = useState<{
    courseId: string;
    courseName: string;
    coursePar: number;
    teeBox: TeeBox;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?returnUrl=/scorecard/live');
      return;
    }
    
    // If we have a scorecard ID in the URL, go straight to the scorecard
    if (scorecardId) {
      setIsSetupComplete(true);
    }
  }, [user, loading, router, scorecardId]);

  const handleCourseSelected = (course: { id: string; name: string; par: number }) => {
    setInitialData((prev) => ({
      ...prev!,
      courseId: course.id,
      courseName: course.name,
      coursePar: course.par,
    }));
  };

  const handleTeeSelected = (teeBox: TeeBox) => {
    setInitialData((prev) => ({
      ...prev!,
      teeBox,
    }));
  };

  const handleStartScoring = () => {
    if (!initialData) return;
    
    if (!initialData.courseId || !initialData.courseName) {
      alert('Please select a golf course');
      return;
    }
    
    setIsSetupComplete(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return null; // Redirect is handled in the useEffect
  }

  // If we have a scorecard ID, skip the setup
  if (scorecardId) {
    return (
      <div className="p-0">
        <LiveScorecard scorecardId={scorecardId} />
      </div>
    );
  }

  if (!isSetupComplete) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Live Scoring</h1>
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

        <Card>
          <CardHeader>
            <CardTitle>Setup Live Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded text-sm">
              <p>Live scoring allows you to track your round hole by hole as you play. 
              Start by selecting the course and tee box you're playing from.</p>
            </div>
            
            <CourseSelector onCourseSelected={handleCourseSelected} />
            
            {initialData?.courseId && (
              <TeeSelector 
                onTeeSelected={handleTeeSelected} 
                initialTeeBox={{
                  ...initialData.teeBox,
                  color: initialData.teeBox.color || 'white' // Ensure color exists
                }}
                courseId={initialData.courseId}
              />
            )}
            
            <div className="flex justify-end">
              <Button
                onClick={handleStartScoring}
                disabled={!initialData?.courseId || !initialData?.teeBox}
              >
                Start Scoring
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-0">
      {initialData && (
        <LiveScorecard initialData={initialData} />
      )}
    </div>
  );
}
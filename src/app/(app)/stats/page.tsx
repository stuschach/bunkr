// src/app/(app)/stats/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';

import { Heading, Text } from '@/components/ui/Typography';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

import { StatsOverview } from '@/components/stats/StatsOverview';
import { ScoreAnalysis } from '@/components/stats/ScoreAnalysis';
import { HandicapAnalysis } from '@/components/stats/HandicapAnalysis';
import { HoleTypeAnalysis } from '@/components/stats/HoleTypeAnalysis';
import { RoundDetails } from '@/components/stats/RoundDetails';
import { Scorecard } from '@/types/scorecard';
import { UserProfile } from '@/types/auth';
import { debugLog } from '@/lib/utils/debug';

export default function StatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rounds, setRounds] = useState<Scorecard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Refresh stats data
  const refreshStats = useCallback(async () => {
    if (authLoading || !user) return;
    
    setIsLoading(true);
    debugLog('Refreshing stats data...');
    
    try {
      // Fetch user profile to get handicap index
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setUserProfile({
          uid: userDocSnap.id,
          email: userData.email || null,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
          createdAt: userData.createdAt || new Date(),
          handicapIndex: userData.handicapIndex || null,
          homeCourse: userData.homeCourse || null,
          profileComplete: userData.profileComplete || false,
          bio: userData.bio || null
        });
      }

      // Build query based on filters
      let roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', user.uid),
        // NEW: Add filter for completed rounds only
        where('state', '==', 'completed'),
        orderBy('date', 'desc')
      );

      // Apply time filter if needed
      if (timeRange !== 'all') {
        const dateLimit = new Date();
        if (timeRange === 'last30') {
          dateLimit.setDate(dateLimit.getDate() - 30);
        } else if (timeRange === 'last90') {
          dateLimit.setDate(dateLimit.getDate() - 90);
        } else if (timeRange === 'thisYear') {
          dateLimit.setMonth(0, 1); // January 1st of current year
        }
        
        // CHANGE THIS: Use a more robust date comparison
        const dateString = dateLimit.toISOString().split('T')[0];
        debugLog('Filtering rounds since:', dateString);
        
        // Use a more flexible query for dates
        roundsQuery = query(
          roundsQuery,
          where('date', '>=', dateString)
        );
      }

      // Apply course filter if needed
      if (courseFilter !== 'all') {
        roundsQuery = query(
          roundsQuery,
          where('courseId', '==', courseFilter)
        );
      }

      // Add debugging to see what's coming back
      debugLog('Executing rounds query...');
      const querySnapshot = await getDocs(roundsQuery);
      debugLog(`Found ${querySnapshot.size} rounds matching the criteria`);
      
      // Debug the documents that were found
      debugLog('Document IDs found:', querySnapshot.docs.map(doc => doc.id));
      
      const roundsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Scorecard));
      
      debugLog('Rounds data loaded:', roundsData.length, 'rounds');
      setRounds(roundsData);
      
      // Set empty state flag if no rounds
      setShowEmptyState(roundsData.length === 0);
      
      // Extract unique courses for filter
      const uniqueCourses = Array.from(
        new Set(roundsData.map(round => round.courseName))
      ).map(name => {
        const round = roundsData.find(r => r.courseName === name);
        return {
          id: round?.courseId || name,
          name: name
        };
      });
      
      setCourses(uniqueCourses);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, timeRange, courseFilter]);

  // Fetch user's profile and rounds
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?returnUrl=/stats');
      return;
    }

    refreshStats();
  }, [user, authLoading, router, timeRange, courseFilter, refreshStats]);

  // Check for URL parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldRefresh = params.get('refresh') === 'true';
    
    if (shouldRefresh) {
      debugLog('Stats refresh requested via URL parameter');
      refreshStats();
      
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [refreshStats]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading stats..." />
      </div>
    );
  }

  // Empty state - no rounds yet
  if (showEmptyState) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <Heading level={2}>Golf Statistics</Heading>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <div className="max-w-md mx-auto">
              <svg
                className="h-24 w-24 text-gray-400 mx-auto mb-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <Heading level={3} className="mb-3">No rounds tracked yet</Heading>
              <Text className="text-gray-600 dark:text-gray-400 mb-6">
                Start tracking your golf rounds to see detailed statistics and analytics.
                Log your scores, track your progress, and improve your game.
              </Text>
              <Button onClick={() => router.push('/scorecard/new')}>
                Add Your First Round
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main stats dashboard
  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Heading level={2}>Golf Statistics</Heading>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={refreshStats} 
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="sm" /> : 'Refresh Stats'}
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-3 w-full mb-4">
        <Select
          options={[
            { value: 'all', label: 'All Time' },
            { value: 'last30', label: 'Last 30 Days' },
            { value: 'last90', label: 'Last 90 Days' },
            { value: 'thisYear', label: 'This Year' },
          ]}
          value={timeRange}
          onChange={setTimeRange}
          className="md:w-40"
        />
        
        <Select
          options={[
            { value: 'all', label: 'All Courses' },
            ...courses.map(course => ({
              value: course.id,
              label: course.name
            }))
          ]}
          value={courseFilter}
          onChange={setCourseFilter}
          className="md:w-56"
        />
      </div>

      {/* Stats Overview - Now passing the user's handicap index */}
      <div className="mb-8">
        <StatsOverview 
          rounds={rounds} 
          userHandicapIndex={userProfile?.handicapIndex} 
        />
      </div>

      {/* Detailed Stats Tabs */}
      <Tabs
        tabs={[
          {
            id: 'scores',
            label: 'Score Analysis',
            icon: <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>,
            content: <ScoreAnalysis rounds={rounds} />
          },
          {
            id: 'handicap',
            label: 'Handicap Tracking',
            icon: <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>,
            content: <HandicapAnalysis 
              rounds={rounds} 
              userHandicapIndex={userProfile?.handicapIndex} 
            />
          },
          {
            id: 'holeTypes',
            label: 'Hole Performance',
            icon: <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>,
            content: <HoleTypeAnalysis rounds={rounds} />
          },
          {
            id: 'rounds',
            label: 'Round Details',
            icon: <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>,
            content: <RoundDetails rounds={rounds} />
          }
        ]}
      />
    </div>
  );
}
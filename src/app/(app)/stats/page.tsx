'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
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

export default function StatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rounds, setRounds] = useState<Scorecard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Fetch user's rounds
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?returnUrl=/stats');
      return;
    }

    const loadRounds = async () => {
      setIsLoading(true);
      try {
        // Build query based on filters
        let roundsQuery = query(
          collection(db, 'scorecards'),
          where('userId', '==', user.uid),
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
          roundsQuery = query(
            roundsQuery,
            where('date', '>=', dateLimit.toISOString().split('T')[0])
          );
        }

        // Apply course filter if needed
        if (courseFilter !== 'all') {
          roundsQuery = query(
            roundsQuery,
            where('courseId', '==', courseFilter)
          );
        }

        const querySnapshot = await getDocs(roundsQuery);
        const roundsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Scorecard));

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
        console.error('Error loading rounds:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRounds();
  }, [user, authLoading, router, timeRange, courseFilter]);

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
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
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
      </div>

      {/* Stats Overview */}
      <div className="mb-8">
        <StatsOverview rounds={rounds} />
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
            content: <HandicapAnalysis rounds={rounds} />
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
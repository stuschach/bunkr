// src/app/(app)/scorecard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';

import { RoundHistory } from '@/components/scorecard/RoundHistory';
import { HandicapHistory } from '@/components/handicap/HandicapHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { UserProfile } from '@/types/auth';
import { Scorecard } from '@/types/scorecard';
import { formatHandicapIndex, formatScoreWithRelationToPar } from '@/lib/utils/formatting';

interface DashboardStats {
  roundsPlayed: number;
  averageScore: number | null;
  bestRound: {
    id: string;
    score: number;
    scoreToPar: number;
    courseName: string;
    date: string;
    par: number;
  } | null;
  handicapIndex: number | null;
  recentTrend: 'improving' | 'declining' | 'stable';
}

export default function ScorecardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    roundsPlayed: 0,
    averageScore: null,
    bestRound: null,
    handicapIndex: null,
    recentTrend: 'stable',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?returnUrl=/scorecard');
      return;
    }

    // Load user profile and dashboard statistics
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // First fetch user profile to get accurate handicap index
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userHandicapIndex = null;
        
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
          
          userHandicapIndex = userData.handicapIndex || null;
        }
        
        // Query for the 20 most recent rounds
        const roundsQuery = query(
          collection(db, 'scorecards'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc'),
          limit(20)
        );
        
        const roundsSnapshot = await getDocs(roundsQuery);
        const rounds = roundsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Scorecard[];
        
        if (rounds.length > 0) {
          // Calculate average score
          const totalScore = rounds.reduce((sum, round) => sum + round.totalScore, 0);
          const averageScore = parseFloat((totalScore / rounds.length).toFixed(1));
          
          // Find best round (lowest score to par)
          const bestRound = rounds.reduce<DashboardStats['bestRound']>((best, round) => {
            const scoreToPar = round.totalScore - round.coursePar;
            if (best === null || scoreToPar < best.scoreToPar) {
              return {
                id: round.id,
                score: round.totalScore,
                scoreToPar: scoreToPar,
                courseName: round.courseName,
                date: round.date,
                par: round.coursePar
              };
            }
            return best;
          }, null);
          
          // Determine trend (for demo, we'll set randomly)
          const trends: DashboardStats['recentTrend'][] = ['improving', 'declining', 'stable'];
          const trend = trends[Math.floor(Math.random() * trends.length)];
          
          // Use handicap index from user profile instead of calculating locally
          // Only fall back to calculation if not available in profile
          const handicapIndex = userHandicapIndex !== null ? 
            userHandicapIndex : 
            calculateApproximateHandicap(rounds);
          
          setDashboardStats({
            roundsPlayed: rounds.length,
            averageScore,
            bestRound,
            handicapIndex,
            recentTrend: trend,
          });
        }
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user, loading, router]);

  // Simple approximate handicap calculation for demo
  // In production, use the proper handicap calculator
  const calculateApproximateHandicap = (rounds: Scorecard[]): number | null => {
    if (rounds.length < 3) return null;
    
    // Get differentials (score - course rating)
    const differentials = rounds
      .filter(round => round.teeBox?.rating !== undefined && round.teeBox?.slope !== undefined)
      .map(round => 
        (round.totalScore - (round.teeBox?.rating || 0)) * 113 / (round.teeBox?.slope || 113)
      );
    
    if (differentials.length === 0) return null;
    
    // Sort from lowest to highest
    differentials.sort((a, b) => a - b);
    
    // Use best half of differentials
    const bestDifferentials = differentials.slice(0, Math.ceil(differentials.length / 2));
    
    // Average and apply 0.96 multiplier
    const handicapIndex = (bestDifferentials.reduce((sum, diff) => sum + diff, 0) / 
      bestDifferentials.length) * 0.96;
    
    // Round to one decimal place
    return Math.round(handicapIndex * 10) / 10;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" color="primary" label="Loading your rounds..." />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold">My Scorecard</h1>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Link href="/scorecard/live">
            <Button variant="outline">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              Live Scoring
            </Button>
          </Link>
          <Link href="/scorecard/new">
            <Button>
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
                  d="M12 4v16m8-8H4" 
                />
              </svg>
              Add Round
            </Button>
          </Link>
        </div>
      </div>

      {/* Handicap Index Card - New Implementation */}
      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between">
              <div className="flex items-center mb-4 md:mb-0">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Handicap Index</div>
                  <div className="flex items-center">
                    <div className="text-2xl font-bold">
                      {dashboardStats.handicapIndex !== null ? formatHandicapIndex(dashboardStats.handicapIndex) : 'N/A'}
                    </div>
                    {dashboardStats.recentTrend !== 'stable' && (
                      <Badge 
                        variant={dashboardStats.recentTrend === 'improving' ? 'success' : 'error'} 
                        className="ml-2"
                      >
                        {dashboardStats.recentTrend === 'improving' ? 'Improving' : 'Increasing'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="ml-6 pl-6 border-l border-gray-200 dark:border-gray-700">
                  <Link href="/handicap/calculator" className="text-sm text-blue-500 hover:underline">
                    Calculator
                  </Link>
                  <div className="h-2"></div>
                  <Link href="/handicap/history" className="text-sm text-blue-500 hover:underline">
                    History
                  </Link>
                </div>
              </div>
              
              {dashboardStats.bestRound && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Best Round</div>
                  <div className="text-xl font-bold">
                    {formatScoreWithRelationToPar(
                      dashboardStats.bestRound.score, 
                      dashboardStats.bestRound.par
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {dashboardStats.bestRound.courseName}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Rounds Played</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboardStats.roundsPlayed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {dashboardStats.averageScore ?? '-'}
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Best Round</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardStats.bestRound ? (
                <div>
                  <div className="text-lg font-bold">
                    {dashboardStats.bestRound.score} ({dashboardStats.bestRound.scoreToPar < 0 
                      ? dashboardStats.bestRound.scoreToPar 
                      : `+${dashboardStats.bestRound.scoreToPar}`})
                  </div>
                  <div className="text-sm text-gray-500">
                    {dashboardStats.bestRound.courseName} • {new Date(dashboardStats.bestRound.date).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold">-</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="text-sm font-medium">Recent Activity</div>
          {/* You could add a list of recent rounds here or keep this space for future features */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Track your rounds consistently to see more detailed statistics and improve your game!
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Round History */}
        <RoundHistory 
          userId={user?.uid} 
          limit={5} 
          showFilters={true}
          showAddButton={false} 
        />
        
        {/* Handicap History */}
        <HandicapHistory 
          userId={user?.uid} 
          limit={5} 
          compact={true} 
        />
      </div>
      
      {/* Resources Section */}
      <div className="mt-12 bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/handicap/calculator">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-green-500">Handicap Calculator</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Calculate your handicap index based on your recent rounds
              </p>
            </div>
          </Link>
          <Link href="/scorecard/stats">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-green-500">Advanced Stats</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analyze your game with detailed statistics and trends
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
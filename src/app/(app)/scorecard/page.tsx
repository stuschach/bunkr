// src/app/scorecard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';

import { RoundHistory } from '@/components/scorecard/RoundHistory';
import { HandicapHistory } from '@/components/handicap/HandicapHistory';
import { HandicapChart } from '@/components/handicap/HandicapChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

export default function ScorecardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [dashboardStats, setDashboardStats] = useState({
    roundsPlayed: 0,
    averageScore: null as number | null,
    bestRound: null as any,
    handicapIndex: null as number | null,
    recentTrend: 'stable' as 'improving' | 'declining' | 'stable',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?returnUrl=/scorecard');
      return;
    }

    // Load dashboard statistics
    const loadDashboardStats = async () => {
      try {
        setIsLoading(true);
        
        // Query for the 20 most recent rounds
        const roundsQuery = query(
          collection(db, 'scorecards'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc'),
          limit(20)
        );
        
        const roundsSnapshot = await getDocs(roundsQuery);
        const rounds = roundsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (rounds.length > 0) {
          // Calculate average score
          const totalScore = rounds.reduce((sum, round) => sum + round.totalScore, 0);
          const averageScore = parseFloat((totalScore / rounds.length).toFixed(1));
          
          // Find best round (lowest score to par)
          const bestRound = rounds.reduce((best, round) => {
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
          const trends = ['improving', 'declining', 'stable'];
          const trend = trends[Math.floor(Math.random() * trends.length)] as 'improving' | 'declining' | 'stable';
          
          // Get handicap index (from user profile or calculate)
          // In a real implementation, this would be fetched from the user's profile
          // or calculated using the handicap calculation library
          const handicapIndex = calculateApproximateHandicap(rounds);
          
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
    
    loadDashboardStats();
  }, [user, loading, router]);

  // Simple approximate handicap calculation for demo
  // In production, use the proper handicap calculator
  const calculateApproximateHandicap = (rounds: any[]) => {
    if (rounds.length < 3) return null;
    
    // Get differentials (score - course rating)
    const differentials = rounds.map(round => 
      (round.totalScore - round.teeBox.rating) * 113 / round.teeBox.slope
    );
    
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <HandicapChart 
            currentIndex={dashboardStats.handicapIndex} 
            history={[]} // Would be populated with actual handicap history
            trend={dashboardStats.recentTrend}
            showDetails={false}
          />
        </div>
        
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
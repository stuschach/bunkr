// src/components/profile/ProfileStats.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatHandicapIndex, formatScoreWithRelationToPar } from '@/lib/utils/formatting';

interface ProfileStatsProps {
  handicapIndex: number | null;
  roundsPlayed: number;
  averageScore: number | null;
  bestScore: {
    score: number;
    course: string;
    date: string;
    par: number;
  } | null;
  // Additional golf statistics
  fairwaysHitPercentage?: number | null;
  greensInRegulationPercentage?: number | null;
  averagePuttsPerRound?: number | null;
  averageDrivingDistance?: number | null;
}

export function ProfileStats({
  handicapIndex,
  roundsPlayed,
  averageScore,
  bestScore,
  fairwaysHitPercentage = null,
  greensInRegulationPercentage = null,
  averagePuttsPerRound = null,
  averageDrivingDistance = null,
}: ProfileStatsProps) {
  const router = useRouter();

  // Helper to format percentages
  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  // Helper to get trend indicator based on handicap
  const getHandicapTrendIndicator = () => {
    // In a real implementation, this would compare to historical handicap data
    // For now, using a demo value
    const trend = handicapIndex !== null && handicapIndex < 15 ? 'improving' : 'neutral';
    
    if (trend === 'improving') {
      return (
        <svg 
          className="h-5 w-5 text-green-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    } else if (trend === 'declining') {
      return (
        <svg 
          className="h-5 w-5 text-red-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Handicap Card */}
      <Card className="overflow-hidden border-green-200 dark:border-green-800 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800">
          <CardTitle className="text-sm text-gray-600 dark:text-gray-400 font-medium">Handicap Index</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {handicapIndex !== null ? formatHandicapIndex(handicapIndex) : 'N/A'}
            </div>
            <div className="ml-2">
              {getHandicapTrendIndicator()}
            </div>
          </div>
          
          {handicapIndex !== null && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {handicapIndex < 5 ? 'Excellent level' : 
               handicapIndex < 10 ? 'Very good level' :
               handicapIndex < 15 ? 'Good level' :
               handicapIndex < 20 ? 'Average level' : 'Casual golfer'}
            </p>
          )}
        </CardContent>
        <CardFooter className="pt-0 pb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs p-0 h-auto text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
            onClick={() => router.push('/handicap/calculator')}
          >
            View Handicap History →
          </Button>
        </CardFooter>
      </Card>

      {/* Rounds Played Card */}
      <Card className="overflow-hidden border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <CardTitle className="text-sm text-gray-600 dark:text-gray-400 font-medium">Rounds Played</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{roundsPlayed}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {roundsPlayed > 50 ? 'Dedicated player' :
             roundsPlayed > 20 ? 'Regular player' :
             roundsPlayed > 10 ? 'Occasional player' : 'New player'}
          </p>
        </CardContent>
        <CardFooter className="pt-0 pb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs p-0 h-auto text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            onClick={() => router.push('/scorecard')}
          >
            View All Rounds →
          </Button>
        </CardFooter>
      </Card>

      {/* Average Score Card */}
      <Card className="overflow-hidden border-purple-200 dark:border-purple-800 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
          <CardTitle className="text-sm text-gray-600 dark:text-gray-400 font-medium">Average Score</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {averageScore !== null ? averageScore.toFixed(1) : 'N/A'}
          </div>
          {averageScore !== null && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {averageScore < 72 ? 'Professional level' :
               averageScore < 80 ? 'Excellent golfer' :
               averageScore < 90 ? 'Good golfer' :
               averageScore < 100 ? 'Average golfer' : 'Developing golfer'}
            </p>
          )}
        </CardContent>
        <CardFooter className="pt-0 pb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs p-0 h-auto text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
            onClick={() => router.push('/stats')}
          >
            View Scoring Trends →
          </Button>
        </CardFooter>
      </Card>

      {/* Best Score Card */}
      <Card className="overflow-hidden border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
          <CardTitle className="text-sm text-gray-600 dark:text-gray-400 font-medium">Best Round</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {bestScore ? (
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatScoreWithRelationToPar(bestScore.score, bestScore.par)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                {bestScore.course} • {new Date(bestScore.date).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">N/A</div>
          )}
        </CardContent>
        {bestScore && (
          <CardFooter className="pt-0 pb-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs p-0 h-auto text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
              onClick={() => router.push(`/scorecard/${bestScore.course.toLowerCase().replace(/\s+/g, '-')}`)}
            >
              View Scorecard →
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Additional Stats - Advanced Golf Metrics */}
      {(fairwaysHitPercentage !== null || greensInRegulationPercentage !== null || 
        averagePuttsPerRound !== null || averageDrivingDistance !== null) && (
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 overflow-hidden border-gray-200 dark:border-gray-700 mt-2">
          <CardHeader className="pb-2 bg-gray-50 dark:bg-gray-800/50">
            <CardTitle className="text-sm md:text-base">Advanced Golf Statistics</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {fairwaysHitPercentage !== null && (
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fairways Hit</div>
                  <div className="text-xl font-bold">{formatPercentage(fairwaysHitPercentage)}</div>
                </div>
              )}
              
              {greensInRegulationPercentage !== null && (
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Greens in Regulation</div>
                  <div className="text-xl font-bold">{formatPercentage(greensInRegulationPercentage)}</div>
                </div>
              )}
              
              {averagePuttsPerRound !== null && (
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Putts per Round</div>
                  <div className="text-xl font-bold">{averagePuttsPerRound.toFixed(1)}</div>
                </div>
              )}
              
              {averageDrivingDistance !== null && (
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Driving Distance</div>
                  <div className="text-xl font-bold">{averageDrivingDistance} yds</div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-0 pb-3 flex justify-center md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/stats')}
              className="text-sm"
            >
              View Full Statistics
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
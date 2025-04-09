// src/components/profile/ProfileStats.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
}

export function ProfileStats({
  handicapIndex,
  roundsPlayed,
  averageScore,
  bestScore,
}: ProfileStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Handicap Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Handicap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">
            {handicapIndex !== null ? formatHandicapIndex(handicapIndex) : 'N/A'}
          </div>
        </CardContent>
      </Card>

      {/* Rounds Played Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Rounds Played</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{roundsPlayed}</div>
        </CardContent>
      </Card>

      {/* Average Score Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Average Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageScore !== null ? averageScore.toFixed(1) : 'N/A'}
          </div>
        </CardContent>
      </Card>

      {/* Best Score Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Best Round</CardTitle>
        </CardHeader>
        <CardContent>
          {bestScore ? (
            <div>
              <div className="text-2xl font-bold">
                {formatScoreWithRelationToPar(bestScore.score, bestScore.par)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {bestScore.course} • {new Date(bestScore.date).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold">N/A</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
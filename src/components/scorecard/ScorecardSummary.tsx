// src/components/scorecard/ScorecardSummary.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { HoleByHole } from './HoleByHole';
import { StatTracker } from './StatTracker';
import { ShareRoundModal } from './ShareRoundModal';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';
import { shareContent, isShareSupported } from '@/lib/utils/share';
import { Scorecard } from '@/types/scorecard';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ScorecardSummaryProps {
  scorecard: Scorecard;
  showActions?: boolean;
}

export function ScorecardSummary({ scorecard, showActions = true }: ScorecardSummaryProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'holes' | 'stats'>('summary');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Check if the current user is the owner of this scorecard
  const isOwner = user?.uid === scorecard.userId;

  // Format date
  const formattedDate = new Date(scorecard.date).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Share the scorecard
  const handleShare = async () => {
    if (isOwner) {
      // Open the share modal for posting to feed
      setIsShareModalOpen(true);
    } else {
      // Use the Web Share API for non-owners
      if (isShareSupported()) {
        const scoreLabel = scorecard.scoreToPar === 0 
          ? 'at even par' 
          : scorecard.scoreToPar > 0 
            ? `+${scorecard.scoreToPar} over par` 
            : `${scorecard.scoreToPar} under par`;
        
        await shareContent({
          title: `Golf round at ${scorecard.courseName}`,
          text: `I shot ${scorecard.totalScore} ${scoreLabel} at ${scorecard.courseName} on ${formattedDate}. Check out my round on Bunkr!`,
          url: window.location.href
        });
      } else {
        // Fallback if Web Share API is not supported
        alert('Share functionality not supported on this browser. Copy the URL to share this round!');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{scorecard.courseName}</CardTitle>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formattedDate} • {scorecard.teeBox.name} ({scorecard.teeBox.yardage} yards)
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-2xl font-bold mr-2">
              {formatScoreWithRelationToPar(scorecard.totalScore, scorecard.coursePar)}
            </div>
            {scorecard.courseHandicap !== null && (
              <Badge variant="outline" className="ml-2">
                Net: {scorecard.totalScore - scorecard.courseHandicap}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Tab Navigation */}
      <div className="px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-b-2 border-green-500 text-green-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'holes'
                ? 'border-b-2 border-green-500 text-green-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('holes')}
          >
            Hole-by-Hole
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-b-2 border-green-500 text-green-500'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Score Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreCard 
                label="Total Score" 
                value={scorecard.totalScore} 
                par={scorecard.coursePar} 
                highlight 
              />
              
              <ScoreCard 
                label="Front 9" 
                value={scorecard.holes.slice(0, 9).reduce((sum, h) => sum + h.score, 0)} 
                par={scorecard.holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)} 
              />
              
              <ScoreCard 
                label="Back 9" 
                value={scorecard.holes.slice(9, 18).reduce((sum, h) => sum + h.score, 0)} 
                par={scorecard.holes.slice(9, 18).reduce((sum, h) => sum + h.par, 0)} 
              />
              
              {scorecard.courseHandicap !== null ? (
                <ScoreCard 
                  label="Net Score" 
                  value={scorecard.totalScore - scorecard.courseHandicap} 
                  par={scorecard.coursePar}
                  isNet 
                />
              ) : (
                <StatCard
                  label="Course Rating/Slope"
                  value={`${scorecard.teeBox.rating}/${scorecard.teeBox.slope}`}
                />
              )}
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <StatCard 
                label="Fairways Hit" 
                value={`${scorecard.stats.fairwaysHit}/${scorecard.stats.fairwaysTotal}`} 
                percentage={scorecard.stats.fairwaysTotal > 0 
                  ? Math.round((scorecard.stats.fairwaysHit / scorecard.stats.fairwaysTotal) * 100) 
                  : 0
                } 
              />
              
              <StatCard 
                label="Greens in Regulation" 
                value={`${scorecard.stats.greensInRegulation}/18`} 
                percentage={Math.round((scorecard.stats.greensInRegulation / 18) * 100)} 
              />
              
              <StatCard 
                label="Putts" 
                value={scorecard.stats.totalPutts.toString()} 
                subValue={`${(scorecard.stats.totalPutts / 18).toFixed(1)} per hole`} 
              />
              
              <StatCard 
                label="Penalties" 
                value={scorecard.stats.penalties?.toString() || '0'} 
              />
            </div>

            {/* Score Distribution */}
            {(scorecard.stats.eagles || scorecard.stats.birdies || scorecard.stats.pars || 
              scorecard.stats.bogeys || scorecard.stats.doubleBogeys || scorecard.stats.worseThanDouble) && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Score Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {scorecard.stats.eagles && scorecard.stats.eagles > 0 && (
                    <Badge variant="success" className="bg-green-600">
                      {scorecard.stats.eagles} Eagle{scorecard.stats.eagles > 1 ? 's' : ''}
                    </Badge>
                  )}
                  
                  {scorecard.stats.birdies && scorecard.stats.birdies > 0 && (
                    <Badge variant="success">
                      {scorecard.stats.birdies} Birdie{scorecard.stats.birdies > 1 ? 's' : ''}
                    </Badge>
                  )}
                  
                  {scorecard.stats.pars && scorecard.stats.pars > 0 && (
                    <Badge variant="secondary">
                      {scorecard.stats.pars} Par{scorecard.stats.pars > 1 ? 's' : ''}
                    </Badge>
                  )}
                  
                  {scorecard.stats.bogeys && scorecard.stats.bogeys > 0 && (
                    <Badge variant="outline" className="text-red-500 border-red-500">
                      {scorecard.stats.bogeys} Bogey{scorecard.stats.bogeys > 1 ? 's' : ''}
                    </Badge>
                  )}
                  
                  {scorecard.stats.doubleBogeys && scorecard.stats.doubleBogeys > 0 && (
                    <Badge variant="error">
                      {scorecard.stats.doubleBogeys} Double{scorecard.stats.doubleBogeys > 1 ? 's' : ''}
                    </Badge>
                  )}
                  
                  {scorecard.stats.worseThanDouble && scorecard.stats.worseThanDouble > 0 && (
                    <Badge variant="error" className="bg-red-700">
                      {scorecard.stats.worseThanDouble} Triple+
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {scorecard.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  {scorecard.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hole-by-Hole Tab */}
        {activeTab === 'holes' && (
          <HoleByHole
            holes={scorecard.holes}
            updateHoleData={() => {}} // Read-only, no updates
            coursePar={scorecard.coursePar}
            readonly={true}
          />
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <StatTracker
            holes={scorecard.holes}
            updateHoleData={() => {}} // Read-only, no updates
            stats={scorecard.stats}
            readonly={true}
          />
        )}
      </CardContent>

      {/* Actions */}
      {showActions && (
        <CardFooter className="border-t border-gray-200 dark:border-gray-800 gap-2">
          <div className="flex justify-between w-full">
            <div>
              {isOwner && (
                <Link href={`/scorecard/${scorecard.id}/edit`}>
                  <Button variant="outline">Edit Round</Button>
                </Link>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleShare}>
                Share
              </Button>
              {isOwner && (
                <Button variant="primary" onClick={() => setIsShareModalOpen(true)}>
                  Post to Feed
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      )}
      
      {/* Share Modal */}
      <ShareRoundModal
        open={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        scorecard={scorecard}
      />
    </Card>
  );
}

// Helper component for score cards
function ScoreCard({ 
  label, 
  value, 
  par, 
  highlight = false,
  isNet = false
}: { 
  label: string; 
  value: number; 
  par: number;
  highlight?: boolean;
  isNet?: boolean;
}) {
  // Calculate score difference to par
  const scoreToPar = value - par;
  let scoreLabel = 'E';
  let scoreColor = 'text-gray-700 dark:text-gray-300';
  
  if (scoreToPar > 0) {
    scoreLabel = `+${scoreToPar}`;
    scoreColor = 'text-red-500';
  } else if (scoreToPar < 0) {
    scoreLabel = scoreToPar.toString();
    scoreColor = 'text-green-500';
  }

  return (
    <div 
      className={`
        p-3 rounded-md 
        ${highlight 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800' 
          : 'bg-gray-50 dark:bg-gray-800'}
      `}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="flex items-baseline">
        <div className={`text-xl font-bold ${isNet ? 'text-blue-500' : ''}`}>
          {value}
        </div>
        <div className={`ml-2 text-sm font-medium ${scoreColor}`}>
          {scoreLabel}
        </div>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ 
  label, 
  value, 
  percentage, 
  subValue 
}: { 
  label: string; 
  value: string; 
  percentage?: number;
  subValue?: string;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      
      {percentage !== undefined && (
        <div className="mt-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
            <div 
              className="bg-green-500 h-full rounded-full" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {percentage}%
          </div>
        </div>
      )}
      
      {subValue && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subValue}
        </div>
      )}
    </div>
  );
}
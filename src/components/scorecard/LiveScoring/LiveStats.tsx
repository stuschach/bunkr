// src/components/scorecard/LiveScoring/LiveStats.tsx
'use client';

import React from 'react';
import { Scorecard } from '@/types/scorecard';
import { Badge } from '@/components/ui/Badge';

interface LiveStatsProps {
  scorecard: Scorecard;
}

export function LiveStats({ scorecard }: LiveStatsProps) {
  // Calculate front 9, back 9, and total scores
  const front9Scores = scorecard.holes.slice(0, 9);
  const back9Scores = scorecard.holes.slice(9, 18);
  
  const front9Par = front9Scores.reduce((sum, hole) => sum + hole.par, 0);
  const back9Par = back9Scores.reduce((sum, hole) => sum + hole.par, 0);
  
  const front9Score = front9Scores.reduce((sum, hole) => sum + (hole.score || 0), 0);
  const back9Score = back9Scores.reduce((sum, hole) => sum + (hole.score || 0), 0);
  
  // Calculate statistics percentages
  const fairwayPercentage = scorecard.stats.fairwaysTotal > 0 
    ? Math.round((scorecard.stats.fairwaysHit / scorecard.stats.fairwaysTotal) * 100) 
    : 0;
    
  const girPercentage = scorecard.holes.some(h => h.score > 0)
    ? Math.round((scorecard.stats.greensInRegulation / scorecard.holes.filter(h => h.score > 0).length) * 100)
    : 0;
    
  const puttsPerHole = scorecard.holes.filter(h => h.score > 0).length > 0
    ? (scorecard.stats.totalPutts / scorecard.holes.filter(h => h.score > 0).length).toFixed(1)
    : '0.0';
  
  // Count holes played
  const holesPlayed = scorecard.holes.filter(h => h.score > 0).length;
  
  // Get score to par string with sign
  const getScoreToPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : diff.toString();
  };

  return (
    <div className="space-y-4">
      {/* Scorecard summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard 
          label="Front 9" 
          value={front9Score > 0 ? front9Score.toString() : '-'} 
          subValue={front9Score > 0 ? getScoreToPar(front9Score, front9Par) : ''} 
        />
        <StatCard 
          label="Back 9" 
          value={back9Score > 0 ? back9Score.toString() : '-'} 
          subValue={back9Score > 0 ? getScoreToPar(back9Score, back9Par) : ''} 
        />
        <StatCard 
          label="Total" 
          value={scorecard.totalScore > 0 ? scorecard.totalScore.toString() : '-'} 
          subValue={scorecard.totalScore > 0 ? getScoreToPar(scorecard.totalScore, scorecard.coursePar) : ''} 
          highlight={true}
        />
      </div>
      
      {/* Stats overview */}
      {holesPlayed > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatCard 
              label="Fairways" 
              value={`${scorecard.stats.fairwaysHit}/${scorecard.stats.fairwaysTotal}`}
              subValue={`${fairwayPercentage}%`}
            />
            <StatCard 
              label="Greens" 
              value={`${scorecard.stats.greensInRegulation}/${holesPlayed}`}
              subValue={`${girPercentage}%`}
            />
            <StatCard 
              label="Putts" 
              value={scorecard.stats.totalPutts.toString()}
              subValue={`${puttsPerHole}/hole`}
            />
          </div>
          
          {/* Score breakdown */}
          {(scorecard.stats.eagles || scorecard.stats.birdies || scorecard.stats.pars || 
            scorecard.stats.bogeys || scorecard.stats.doubleBogeys || scorecard.stats.worseThanDouble) && (
            <div className="flex flex-wrap gap-1 mt-2">
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
          )}
        </>
      )}
    </div>
  );
}

// Helper component for stat cards
function StatCard({ 
  label, 
  value, 
  subValue,
  highlight = false
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div 
      className={`
        p-2 rounded-md text-center 
        ${highlight 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800' 
          : 'bg-gray-50 dark:bg-gray-800'}
      `}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-green-500' : ''}`}>{value}</div>
      {subValue && (
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{subValue}</div>
      )}
    </div>
  );
}
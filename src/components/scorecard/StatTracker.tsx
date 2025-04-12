// src/components/scorecard/StatTracker.tsx
'use client';

import React from 'react';
import { HoleData } from '@/types/scorecard';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface StatTrackerProps {
  holes: HoleData[];
  updateHoleData: (holeNumber: number, data: Partial<HoleData>) => void;
  stats: {
    totalScore: number;
    totalPutts: number;
    fairwaysHit: number;
    fairwaysTotal: number;
    greensInRegulation: number;
    penalties: number;
    eagles?: number;
    birdies?: number;
    pars?: number;
    bogeys?: number;
    doubleBogeys?: number;
    worseThanDouble?: number;
  };
  readonly?: boolean;
}

export function StatTracker({ 
  holes, 
  updateHoleData, 
  stats,
  readonly = false
}: StatTrackerProps) {
  // Calculate percentages and averages
  const fairwayPercentage = calculateFairwayPercentage(stats.fairwaysHit, stats.fairwaysTotal);
  
  const girPercentage = Math.round((stats.greensInRegulation / 18) * 100);
  
  const puttsPerHole = holes.filter(h => h.score > 0).length > 0
    ? (stats.totalPutts / holes.filter(h => h.score > 0).length).toFixed(1)
    : '0.0';
  
  // Count total holes played
  const holesPlayed = holes.filter(h => h.score > 0).length;

  // Function to calculate fairway percentage properly
  function calculateFairwayPercentage(fairwaysHit: number, fairwaysTotal: number): number {
    // Only calculate percentage if there are non-par-3 holes
    if (fairwaysTotal > 0) {
      return Math.round((fairwaysHit / fairwaysTotal) * 100);
    }
    // Return 0 if there are no non-par-3 holes
    return 0;
  }
  
  // Function to render fairway data in the table
  function fairwayCell(hole: HoleData) {
    if (hole.par <= 3) {
      return <span className="text-gray-400">N/A</span>;
    } else if (hole.fairwayHit === true) {
      return <span className="text-green-500">✓</span>;
    } else if (hole.fairwayHit === false) {
      return <span className="text-red-500">✗</span>;
    } else {
      return <span className="text-gray-400">-</span>;
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Fairways Hit"
          value={`${stats.fairwaysHit}/${stats.fairwaysTotal}`}
          percentage={fairwayPercentage}
        />
        
        <StatCard
          title="Greens in Regulation"
          value={`${stats.greensInRegulation}/18`}
          percentage={girPercentage}
        />
        
        <StatCard
          title="Average Putts"
          value={`${puttsPerHole} per hole`}
          subValue={`${stats.totalPutts} total`}
        />
        
        <StatCard
          title="Penalty Strokes"
          value={`${stats.penalties}`}
        />
      </div>
      
      {/* Score distribution */}
      <div>
        <h3 className="text-lg font-medium mb-3">Score Distribution</h3>
        
        <div className="flex flex-wrap gap-2">
          {stats.eagles && stats.eagles > 0 && (
            <Badge variant="success" className="bg-green-600">
              {stats.eagles} Eagle{stats.eagles > 1 ? 's' : ''}
            </Badge>
          )}
          
          {stats.birdies && stats.birdies > 0 && (
            <Badge variant="success">
              {stats.birdies} Birdie{stats.birdies > 1 ? 's' : ''}
            </Badge>
          )}
          
          {stats.pars && stats.pars > 0 && (
            <Badge variant="secondary">
              {stats.pars} Par{stats.pars > 1 ? 's' : ''}
            </Badge>
          )}
          
          {stats.bogeys && stats.bogeys > 0 && (
            <Badge variant="outline" className="text-red-500 border-red-500">
              {stats.bogeys} Bogey{stats.bogeys > 1 ? 's' : ''}
            </Badge>
          )}
          
          {stats.doubleBogeys && stats.doubleBogeys > 0 && (
            <Badge variant="error">
              {stats.doubleBogeys} Double{stats.doubleBogeys > 1 ? 's' : ''}
            </Badge>
          )}
          
          {stats.worseThanDouble && stats.worseThanDouble > 0 && (
            <Badge variant="error" className="bg-red-700">
              {stats.worseThanDouble} Triple+
            </Badge>
          )}
        </div>
      </div>
      
      {/* Hole-by-hole stats */}
      {!readonly && (
        <div>
          <h3 className="text-lg font-medium mb-3">Hole-by-Hole Stats</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hole
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fairway
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GIR
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Putts
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {holes.map((hole) => {
                  // Calculate score to par
                  const scoreToPar = hole.score - hole.par;
                  const scoreClass = scoreToPar < 0 
                    ? 'text-green-500' 
                    : scoreToPar === 0 
                    ? 'text-gray-700 dark:text-gray-300' 
                    : 'text-red-500';
                  
                  return (
                    <tr key={hole.number}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium">{hole.number}</span>
                      </td>
                      <td className={`px-3 py-2 text-center whitespace-nowrap ${scoreClass}`}>
                        {hole.score || '-'}
                        {hole.score > 0 && (
                          <span className="ml-1">
                            {scoreToPar === 0 
                              ? '(E)' 
                              : scoreToPar > 0 
                                ? `(+${scoreToPar})` 
                                : `(${scoreToPar})`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {fairwayCell(hole)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {hole.greenInRegulation ? (
                          <span className="text-green-500">✓</span>
                        ) : hole.greenInRegulation === false ? (
                          <span className="text-red-500">✗</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {hole.putts || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Stats explanation */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md text-sm">
        <h4 className="font-medium mb-2">Understanding Your Stats</h4>
        <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
          <li>
            <strong>GIR (Greens in Regulation)</strong> - Reaching the green in par minus 2 strokes 
            (e.g., reaching a par 4 green in 2 shots)
          </li>
          <li>
            <strong>Fairways Hit</strong> - Successfully hitting the fairway on your tee shot 
            (only counted on par 4s and 5s)
          </li>
          <li>
            <strong>Putts</strong> - Number of strokes taken on the green
          </li>
        </ul>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ 
  title, 
  value, 
  percentage, 
  subValue 
}: { 
  title: string; 
  value: string; 
  percentage?: number;
  subValue?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <div className="text-lg font-bold">{value}</div>
        
        {percentage !== undefined && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
              <div 
                className="bg-green-500 h-full rounded-full" 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {percentage}%
            </div>
          </div>
        )}
        
        {subValue && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {subValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
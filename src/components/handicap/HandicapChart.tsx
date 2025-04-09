// src/components/handicap/HandicapChart.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface HandicapHistoryPoint {
  date: string;
  handicapIndex: number;
  scoreDifferentials: number[];
}

interface HandicapChartProps {
  currentIndex: number | null;
  history: HandicapHistoryPoint[];
  trend?: 'improving' | 'declining' | 'stable';
  showDetails?: boolean;
}

export function HandicapChart({
  currentIndex,
  history,
  trend = 'stable',
  showDetails = false,
}: HandicapChartProps) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // Sort history by date, newest first
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Get the displayed history based on the showAllHistory state
  const displayedHistory = showAllHistory 
    ? sortedHistory 
    : sortedHistory.slice(0, 5);
  
  // Calculate the min and max handicap for chart scaling
  const handicapValues = history.map(h => h.handicapIndex);
  const minHandicap = Math.min(...handicapValues) - 1;
  const maxHandicap = Math.max(...handicapValues) + 1;
  
  // Determine trend icon and color
  let trendIcon = null;
  let trendColor = '';

  if (trend === 'improving') {
    trendColor = 'text-green-500';
    trendIcon = (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    );
  } else if (trend === 'declining') {
    trendColor = 'text-red-500';
    trendIcon = (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  }

  // If no data, show a message
  if (!currentIndex && history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Handicap Index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              No handicap data available yet. 
              <br />
              Log at least 3 rounds to get your handicap index.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handicap Index</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Current handicap display */}
        <div className="flex items-center mb-6">
          <div className="text-3xl font-bold">
            {currentIndex !== null ? formatHandicapIndex(currentIndex) : 'N/A'}
          </div>
          {trendIcon && (
            <div className={`ml-2 ${trendColor}`}>{trendIcon}</div>
          )}
          
          {/* Trend badge */}
          {trend !== 'stable' && (
            <Badge 
              variant={trend === 'improving' ? 'success' : 'error'} 
              className="ml-3"
            >
              {trend === 'improving' ? 'Improving' : 'Increasing'}
            </Badge>
          )}
        </div>
        
        {/* Handicap chart */}
        {history.length > 0 && (
          <>
            <div className="h-32 relative mb-4">
              {/* Chart grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                <div className="border-t border-gray-200 dark:border-gray-800 h-0"></div>
                <div className="border-t border-gray-200 dark:border-gray-800 h-0"></div>
                <div className="border-t border-gray-200 dark:border-gray-800 h-0"></div>
              </div>
              
              {/* Lines connecting points */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                <polyline
                  points={history.map((point, index) => {
                    const x = index * (100 / (history.length - 1));
                    // Invert the y-axis to make lower handicaps higher on the chart
                    const y = 100 - ((point.handicapIndex - minHandicap) / (maxHandicap - minHandicap) * 100);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#4d8a54"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              
              {/* Data points */}
              <div className="absolute inset-0">
                {history.map((point, index) => {
                  const left = `${index * (100 / (history.length - 1))}%`;
                  // Invert the y-axis to make lower handicaps higher on the chart
                  const top = `${100 - ((point.handicapIndex - minHandicap) / (maxHandicap - minHandicap) * 100)}%`;
                  
                  return (
                    <div
                      key={index}
                      className="absolute w-2 h-2 bg-green-500 rounded-full transform -translate-x-1 -translate-y-1"
                      style={{ left, top }}
                      title={`${formatHandicapIndex(point.handicapIndex)} on ${new Date(point.date).toLocaleDateString()}`}
                    ></div>
                  );
                })}
              </div>
            </div>
            
            {/* Y-axis labels */}
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
              <div>{formatHandicapIndex(maxHandicap)}</div>
              <div>{formatHandicapIndex(minHandicap)}</div>
            </div>
          </>
        )}
        
        {/* Handicap history list (shown if showDetails is true) */}
        {showDetails && history.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Handicap History</h3>
            <div className="space-y-2">
              {displayedHistory.map((point, index) => (
                <div
                  key={index}
                  className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 text-sm"
                >
                  <div>
                    {new Date(point.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="font-medium">
                    {formatHandicapIndex(point.handicapIndex)}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show more/less button */}
            {history.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-sm"
                onClick={() => setShowAllHistory(!showAllHistory)}
              >
                {showAllHistory ? 'Show Less' : `Show More (${history.length - 5} more)`}
              </Button>
            )}
          </div>
        )}
        
        {/* Info about handicap calculation */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 bg-gray-50 dark:bg-gray-800 p-2 rounded">
          <p>
            Handicap Index calculated using the USGA™ system.
            Based on the best 8 of your last 20 rounds.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
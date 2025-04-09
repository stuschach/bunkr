// src/components/profile/HandicapDisplay.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface HandicapDisplayProps {
  handicapIndex: number | null;
  trend?: 'improving' | 'declining' | 'stable';
  history?: Array<{
    date: string;
    value: number;
  }>;
}

export function HandicapDisplay({
  handicapIndex,
  trend = 'stable',
  history = [],
}: HandicapDisplayProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handicap Index</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center">
          <div className="text-3xl font-bold">
            {handicapIndex !== null ? formatHandicapIndex(handicapIndex) : 'N/A'}
          </div>
          {trendIcon && (
            <div className={`ml-2 ${trendColor}`}>{trendIcon}</div>
          )}
        </div>
        
        {history.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Recent History</div>
            <div className="relative h-12">
              {/* Simple line chart visualization */}
              <div className="absolute inset-0 flex items-end">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="flex-1 relative mx-1"
                    style={{
                      height: `${100 - Math.min(100, Math.max(0, (item.value + 5) * 100 / 60))}%`
                    }}
                  >
                    <div className="absolute bottom-0 inset-x-0 bg-green-500 rounded-t-sm" style={{ height: '100%' }}></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              {history.length > 0 && (
                <>
                  <div>{new Date(history[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                  <div>{new Date(history[history.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
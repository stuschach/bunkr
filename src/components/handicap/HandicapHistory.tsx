// src/components/handicap/HandicapHistory.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface HandicapRecord {
  id: string;
  userId: string;
  handicapIndex: number;
  date: string;
  includedRounds: string[]; // IDs of rounds used in calculation
  differentials: number[]; // Score differentials used
  trend: 'improving' | 'declining' | 'stable';
  lowIndex: number; // Lowest index in past 365 days
}

interface HandicapHistoryProps {
  userId?: string; // If provided, show handicap for a specific user
  limit?: number;
  compact?: boolean;
}

export function HandicapHistory({ 
  userId, 
  limit = 10,
  compact = false
}: HandicapHistoryProps) {
  const { user } = useAuth();
  
  // State for handicap history
  const [history, setHistory] = useState<HandicapRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);
  
  // Get the target user ID - either from props or current user
  const targetUserId = userId || user?.uid;
  
  // Load handicap history
  useEffect(() => {
    if (!targetUserId) {
      setIsLoading(false);
      setError('No user ID available');
      return;
    }
    
    const loadHandicapHistory = async () => {
      try {
        setIsLoading(true);
        
        // Query Firestore for handicap records
        const handicapQuery = query(
          collection(db, 'handicapRecords'),
          where('userId', '==', targetUserId),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(handicapQuery);
        
        // Parse handicap records
        const records: HandicapRecord[] = [];
        querySnapshot.forEach(doc => {
          records.push({
            id: doc.id,
            ...doc.data()
          } as HandicapRecord);
        });
        
        setHistory(records);
      } catch (error) {
        console.error('Error loading handicap history:', error);
        setError('Failed to load handicap history');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHandicapHistory();
  }, [targetUserId]);
  
  // Get the current handicap index
  const currentHandicap = history.length > 0 ? history[0].handicapIndex : null;
  
  // If no history is available yet, show information about handicap calculation
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Handicap History</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner size="lg" color="primary" label="Loading handicap data..." />
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Handicap History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Handicap History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <h3 className="text-lg font-medium mb-2">No handicap data yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {user && user.uid === targetUserId
                ? 'Log at least 3 rounds to establish your handicap index.'
                : 'This user has not established a handicap index yet.'}
            </p>
            {user && user.uid === targetUserId && (
              <Button onClick={() => window.location.href = '/scorecard/new'}>
                Log a Round
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Determine how many records to show based on 'showAll' state
  const visibleRecords = showAll ? history : history.slice(0, limit);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Handicap History</span>
          {currentHandicap !== null && (
            <Badge variant="outline" className="text-base">
              Current: {formatHandicapIndex(currentHandicap)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Display handicap history as a list */}
        <div className="space-y-1">
          {visibleRecords.map((record, index) => (
            <div 
              key={record.id}
              className={cn(
                "flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-800",
                index === 0 ? "bg-green-50 dark:bg-green-900/20" : ""
              )}
            >
              <div>
                <div className="font-medium">
                  {new Date(record.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                {!compact && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Based on {record.includedRounds.length} rounds
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <div className="text-xl font-bold">
                  {formatHandicapIndex(record.handicapIndex)}
                </div>
                
                {!compact && record.trend !== 'stable' && (
                  <div 
                    className={cn(
                      "ml-2",
                      record.trend === 'improving' ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {record.trend === 'improving' ? (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Show more/less button */}
        {history.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 w-full text-sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All (${history.length - limit} more)`}
          </Button>
        )}
        
        {/* Info about handicap calculation */}
        {!compact && (
          <div className="mt-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-sm">
            <h4 className="font-medium mb-1">About Your Handicap Index</h4>
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              Your Handicap Index is calculated using the USGA™ system. It uses the best 8 of your last 20 rounds,
              applying a "bonus for excellence" factor of 0.96. Your index is updated each time you post a new score.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to conditionally apply class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
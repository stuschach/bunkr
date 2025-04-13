// src/lib/hooks/stats/useRounds.ts
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Scorecard } from '@/types/scorecard';
import { RoundsOptions } from './types';

export function useRounds({
  userId,
  timeRange = 'all',
  courseId = 'all',
  limit: queryLimit = 100,
  includeIncomplete = false
}: RoundsOptions) {
  // Initialize rounds as an empty array, not undefined
  const [rounds, setRounds] = useState<Scorecard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch rounds data
  useEffect(() => {
    const fetchRounds = async () => {
      // Don't attempt to fetch if no userId is provided
      if (!userId) {
        setRounds([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build query based on filters
        let roundsQuery = query(
          collection(db, 'scorecards'),
          where('userId', '==', userId)
        );

        // Add state filter if we only want completed rounds
        if (!includeIncomplete) {
          roundsQuery = query(
            roundsQuery,
            where('state', '==', 'completed')
          );
        }

        // Apply time filter if needed
        if (timeRange !== 'all') {
          const dateLimit = new Date();
          if (timeRange === 'last30') {
            dateLimit.setDate(dateLimit.getDate() - 30);
          } else if (timeRange === 'last90') {
            dateLimit.setDate(dateLimit.getDate() - 90);
          } else if (timeRange === 'thisYear') {
            dateLimit.setMonth(0, 1); // January 1st of current year
          }
          
          const dateString = dateLimit.toISOString().split('T')[0];
          roundsQuery = query(
            roundsQuery,
            where('date', '>=', dateString)
          );
        }

        // Apply course filter if needed
        if (courseId !== 'all') {
          roundsQuery = query(
            roundsQuery,
            where('courseId', '==', courseId)
          );
        }

        // Add ordering and limit
        roundsQuery = query(
          roundsQuery,
          orderBy('date', 'desc'),
          firestoreLimit(queryLimit)
        );

        const querySnapshot = await getDocs(roundsQuery);
        const roundsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Scorecard));
        
        setRounds(roundsData);
      } catch (err) {
        console.error('Error fetching rounds for stats:', err);
        setError('Failed to load stats data');
        // Set rounds to empty array on error
        setRounds([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRounds();
  }, [userId, timeRange, courseId, queryLimit, includeIncomplete]);

  return {
    rounds,
    isLoading,
    error,
    refreshRounds: () => {
      setIsLoading(true);
      // The effect will run again because isLoading changed
    }
  };
}
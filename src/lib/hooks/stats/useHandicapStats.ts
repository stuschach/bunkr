// src/lib/hooks/stats/useHandicapStats.ts
import { useMemo } from 'react';
import { Scorecard } from '@/types/scorecard';
import { calculateHandicapIndex } from '@/lib/handicap/calculator';
import { useRounds } from './useRounds';
import { RoundsOptions, HandicapData } from './types';

export function useHandicapStats(options: RoundsOptions) {
  const { rounds = [], isLoading, error, refreshRounds } = useRounds(options);

  const handicapData = useMemo((): HandicapData | null => {
    // Check for both undefined and empty array
    if (!rounds || rounds.length === 0) return null;
    
    // Sort rounds by date (oldest first for history)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate handicap history
    const handicapHistory = sortedRounds.map((round, index) => {
      // Get all rounds up to this point
      const roundsUpToNow = sortedRounds.slice(0, index + 1);
      
      // Need at least 3 rounds to calculate handicap
      const handicap = roundsUpToNow.length >= 3 
        ? calculateHandicapIndex(roundsUpToNow) 
        : null;
      
      return {
        date: round.date,
        handicap,
        roundCount: roundsUpToNow.length
      };
    });
    
    // Current handicap is the last valid handicap in history
    const current = handicapHistory.length > 0 && handicapHistory[handicapHistory.length - 1].handicap !== null
      ? handicapHistory[handicapHistory.length - 1].handicap
      : null;
    
    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (handicapHistory.length >= 5) {
      const recent = current;
      const previous = handicapHistory[handicapHistory.length - 5].handicap;
      
      if (recent !== null && previous !== null) {
        if (recent < previous - 0.5) trend = 'improving';
        else if (recent > previous + 0.5) trend = 'declining';
      }
    }
    
    // Calculate counting rounds (those used in handicap calculation)
    let countingRounds: Scorecard[] = [];
    if (sortedRounds.length >= 3) {
      // Get the last 20 rounds max
      const recentRounds = sortedRounds.slice(-20);
      
      // Determine how many scores to use based on USGA rules
      const countToUse = 
        recentRounds.length <= 3 ? 1 :
        recentRounds.length <= 4 ? 1 :
        recentRounds.length <= 5 ? 1 :
        recentRounds.length <= 6 ? 2 :
        recentRounds.length <= 8 ? 2 :
        recentRounds.length <= 9 ? 3 :
        recentRounds.length <= 11 ? 3 :
        recentRounds.length <= 12 ? 4 :
        recentRounds.length <= 14 ? 4 :
        recentRounds.length <= 15 ? 5 :
        recentRounds.length <= 16 ? 5 :
        recentRounds.length <= 17 ? 6 :
        recentRounds.length <= 18 ? 6 :
        recentRounds.length <= 19 ? 7 : 8;
      
      // Calculate differentials and take the best ones
      const roundsWithDiff = recentRounds.map(round => {
        const differential = round.teeBox?.rating && round.teeBox?.slope
          ? ((round.totalScore - round.teeBox.rating) * 113) / round.teeBox.slope
          : null;
        
        return { 
          ...round, 
          differential 
        };
      });
      
      // Sort by differential and take the best N
      countingRounds = roundsWithDiff
        .filter(r => r.differential !== null)
        .sort((a, b) => (a.differential || 0) - (b.differential || 0))
        .slice(0, countToUse);
    }
    
    // Calculate potential handicap (if you shot a great round)
    let potentialHandicap = null;
    if (current !== null && rounds.length >= 3) {
      // Create a copy of the rounds
      const roundsCopy = [...sortedRounds];
      
      // Add a hypothetical excellent round (5 under your current handicap)
      const lastRound = roundsCopy[roundsCopy.length - 1];
      const goodScore = Math.max(lastRound.coursePar + Math.floor(current) - 5, lastRound.coursePar - 3);
      
      const hypotheticalRound: Scorecard = {
        ...lastRound,
        id: 'hypothetical',
        date: new Date().toISOString().split('T')[0],
        totalScore: goodScore
      };
      
      roundsCopy.push(hypotheticalRound);
      
      // Calculate new potential handicap
      potentialHandicap = calculateHandicapIndex(roundsCopy);
    }
    
    return {
      history: handicapHistory,
      current,
      trend,
      countingRounds,
      potential: potentialHandicap
    };
  }, [rounds]);

  return {
    handicapData,
    rounds: rounds || [], // Ensure we return an array
    isLoading,
    error,
    refreshData: refreshRounds
  };
}
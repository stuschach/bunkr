// src/lib/hooks/stats/useOverviewStats.ts
import { useMemo } from 'react';
import { useRounds } from './useRounds';
import { RoundsOptions, OverviewStats } from './types';
import { calculateHandicapIndex } from '@/lib/handicap/calculator';

export function useOverviewStats(options: RoundsOptions) {
  const { rounds = [], isLoading, error, refreshRounds } = useRounds(options);

  const overviewStats = useMemo((): OverviewStats | null => {
    // Check for both undefined and empty array
    if (!rounds || rounds.length === 0) return null;

    // Sort rounds by date (most recent first)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Get the 20 most recent rounds for calculations
    const recentRounds = sortedRounds.slice(0, 20);
    
    // Calculate average score
    const avgScore = recentRounds.reduce((sum, round) => sum + round.totalScore, 0) / recentRounds.length;
    
    // Calculate scoring trends (last 5 rounds vs previous 5)
    const last5 = recentRounds.slice(0, 5);
    const prev5 = recentRounds.slice(5, 10);
    
    const last5Avg = last5.length 
      ? last5.reduce((sum, round) => sum + round.totalScore, 0) / last5.length 
      : 0;
    const prev5Avg = prev5.length 
      ? prev5.reduce((sum, round) => sum + round.totalScore, 0) / prev5.length 
      : 0;
    
    const scoringTrend = prev5.length ? last5Avg - prev5Avg : 0;
    
    // Find best/worst rounds
    const bestRound = [...rounds].sort((a, b) => {
      // Compare score relative to par
      const aScoreToPar = a.totalScore - a.coursePar;
      const bScoreToPar = b.totalScore - b.coursePar;
      return aScoreToPar - bScoreToPar;
    })[0];
    
    // Calculate stats
    const totalRounds = rounds.filter(round => round.state === 'completed').length;
    const roundsThisYear = rounds.filter(round => {
      const roundDate = new Date(round.date);
      const currentYear = new Date().getFullYear();
      return roundDate.getFullYear() === currentYear && round.state === 'completed';
    }).length;
    
    // Calculate handicap index
    const handicapIndex = calculateHandicapIndex(rounds);
    
    // Calculate FIR, GIR, and putts per round averages
    const fairwaysHit = rounds.reduce((sum, round) => sum + (round.stats?.fairwaysHit || 0), 0);
    const fairwaysTotal = rounds.reduce((sum, round) => sum + (round.stats?.fairwaysTotal || 0), 0);
    const greensInRegulation = rounds.reduce((sum, round) => sum + (round.stats?.greensInRegulation || 0), 0);
    const putts = rounds.reduce((sum, round) => sum + (round.stats?.totalPutts || 0), 0);
    
    const firPercent = fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : 0;
    const girPercent = rounds.length > 0 ? (greensInRegulation / (rounds.length * 18)) * 100 : 0;
    const puttsPerRound = rounds.length > 0 ? putts / rounds.length : 0;
    
    return {
      totalRounds,
      roundsThisYear,
      handicapIndex,
      avgScore,
      scoringTrend,
      bestRound,
      firPercent,
      girPercent,
      puttsPerRound
    };
  }, [rounds]);

  return {
    overviewStats,
    rounds: rounds || [], // Ensure we return an array
    isLoading,
    error,
    refreshData: refreshRounds
  };
}
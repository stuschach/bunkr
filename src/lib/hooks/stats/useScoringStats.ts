// src/lib/hooks/stats/useScoringStats.ts
import { useMemo } from 'react';
import { useRounds } from './useRounds';
import { RoundsOptions, ScoringData } from './types';

export function useScoringStats(options: RoundsOptions) {
  const { rounds = [], isLoading, error, refreshRounds } = useRounds(options);

  const scoringData = useMemo((): ScoringData | null => {
    // Check for both undefined and empty array
    if (!rounds || rounds.length === 0) return null;
    
    // Sort rounds by date (oldest first for the chart)
    const sortedRounds = [...rounds].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Get recent rounds for calculations (most recent first)
    const recentRounds = [...rounds].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Calculate average score
    const totalScore = recentRounds.reduce((sum, round) => sum + round.totalScore, 0);
    const averageScore = recentRounds.length > 0 ? totalScore / recentRounds.length : null;
    
    // Find best round (lowest score to par)
    const bestRound = rounds.length > 0 
      ? [...rounds].sort((a, b) => {
          const aScoreToPar = a.totalScore - a.coursePar;
          const bScoreToPar = b.totalScore - b.coursePar;
          return aScoreToPar - bScoreToPar;
        })[0]
      : null;
    
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
    
    // Prepare data for score trend chart
    const trend = sortedRounds.map(round => {
      const scoreToPar = round.totalScore - round.coursePar;
      return {
        date: new Date(round.date).toLocaleDateString(),
        score: round.totalScore,
        par: round.coursePar,
        scoreToPar: scoreToPar,
        courseId: round.courseId,
        courseName: round.courseName
      };
    });
    
    // Calculate score distribution
    const scoreDistribution: Record<number, number> = {};
    
    // Determine score range (typically -5 to +15 relative to par)
    const minScore = Math.min(...rounds.map(r => r.totalScore - r.coursePar));
    const maxScore = Math.max(...rounds.map(r => r.totalScore - r.coursePar));
    
    // Initialize all scores in range with zero
    for (let i = minScore; i <= maxScore; i++) {
      scoreDistribution[i] = 0;
    }
    
    // Count occurrences
    rounds.forEach(round => {
      const scoreToPar = round.totalScore - round.coursePar;
      scoreDistribution[scoreToPar] = (scoreDistribution[scoreToPar] || 0) + 1;
    });
    
    // Convert to array for chart
    const distribution = Object.entries(scoreDistribution).map(([scoreToPar, count]) => ({
      scoreToPar: parseInt(scoreToPar),
      count,
      percentage: (count / rounds.length) * 100
    })).sort((a, b) => a.scoreToPar - b.scoreToPar);
    
    return {
      trend,
      distribution,
      averageScore,
      bestRound,
      scoringTrend
    };
  }, [rounds]);

  return {
    scoringData,
    rounds: rounds || [], // Ensure we return an array
    isLoading,
    error,
    refreshData: refreshRounds
  };
}
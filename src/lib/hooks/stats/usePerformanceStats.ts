// src/lib/hooks/stats/usePerformanceStats.ts
import { useMemo } from 'react';
import { useRounds } from './useRounds';
import { RoundsOptions, PerformanceData } from './types';

export function usePerformanceStats(options: RoundsOptions) {
  const { rounds = [], isLoading, error, refreshRounds } = useRounds(options);

  const performanceData = useMemo((): PerformanceData | null => {
    // Check for both undefined and empty array
    if (!rounds || rounds.length === 0) return null;
    
    // Count rounds that have stats
    const roundsWithStats = rounds.filter(r => 
      r.stats && (
        r.stats.fairwaysHit !== undefined || 
        r.stats.greensInRegulation !== undefined || 
        r.stats.totalPutts !== undefined
      )
    ).length;
    
    if (roundsWithStats === 0) {
      return {
        fairwaysHitPercentage: 0,
        greensInRegulationPercentage: 0,
        puttsPerRound: 0,
        averageDrivingDistance: null,
        roundsWithStats: 0
      };
    }
    
    // Calculate fairways hit percentage
    let fairwaysHit = 0;
    let fairwaysTotal = 0;
    
    rounds.forEach(round => {
      if (round.stats && typeof round.stats.fairwaysHit === 'number' && typeof round.stats.fairwaysTotal === 'number') {
        fairwaysHit += round.stats.fairwaysHit;
        fairwaysTotal += round.stats.fairwaysTotal;
      }
    });
    
    const fairwaysHitPercentage = fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : 0;
    
    // Calculate greens in regulation percentage
    let greensInRegulation = 0;
    let greensTotal = 0;
    
    rounds.forEach(round => {
      if (round.stats && typeof round.stats.greensInRegulation === 'number') {
        greensInRegulation += round.stats.greensInRegulation;
        greensTotal += 18; // Assuming 18 holes
      }
    });
    
    const greensInRegulationPercentage = greensTotal > 0 ? (greensInRegulation / greensTotal) * 100 : 0;
    
    // Calculate putts per round
    let totalPutts = 0;
    let roundsWithPutts = 0;
    
    rounds.forEach(round => {
      if (round.stats && typeof round.stats.totalPutts === 'number') {
        totalPutts += round.stats.totalPutts;
        roundsWithPutts++;
      }
    });
    
    const puttsPerRound = roundsWithPutts > 0 ? totalPutts / roundsWithPutts : 0;
    
    // Calculate average driving distance
    let totalDrivingDistance = 0;
    let roundsWithDrivingDistance = 0;
    
    rounds.forEach(round => {
      if (round.stats && typeof round.stats.averageDrivingDistance === 'number') {
        totalDrivingDistance += round.stats.averageDrivingDistance;
        roundsWithDrivingDistance++;
      }
    });
    
    const averageDrivingDistance = roundsWithDrivingDistance > 0 
      ? totalDrivingDistance / roundsWithDrivingDistance 
      : null;
    
    // Calculate best and worst holes
    const holeStats: Record<number, { count: number, total: number }> = {};
    
    rounds.forEach(round => {
      if (!round.holes || round.holes.length === 0) return;
      
      round.holes.forEach((hole, index) => {
        const holeNumber = index + 1;
        
        if (!holeStats[holeNumber]) {
          holeStats[holeNumber] = { count: 0, total: 0 };
        }
        
        holeStats[holeNumber].count++;
        holeStats[holeNumber].total += (hole.score - hole.par);
      });
    });
    
    // Convert to array and calculate averages
    const holePerformance = Object.entries(holeStats).map(([holeNumber, stats]) => ({
      holeNumber: parseInt(holeNumber),
      avgScoreToPar: stats.count > 0 ? stats.total / stats.count : 0,
      count: stats.count
    }));
    
    // Find best and worst holes
    const bestHole = holePerformance.length > 0 
      ? [...holePerformance].sort((a, b) => a.avgScoreToPar - b.avgScoreToPar)[0]
      : null;
    
    const worstHole = holePerformance.length > 0
      ? [...holePerformance].sort((a, b) => b.avgScoreToPar - a.avgScoreToPar)[0]
      : null;
    
    return {
      fairwaysHitPercentage,
      greensInRegulationPercentage,
      puttsPerRound,
      averageDrivingDistance,
      roundsWithStats,
      bestHole,
      worstHole
    };
  }, [rounds]);

  return {
    performanceData,
    rounds: rounds || [], // Ensure we return an array
    isLoading,
    error,
    refreshData: refreshRounds
  };
}
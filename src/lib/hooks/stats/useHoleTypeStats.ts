// src/lib/hooks/stats/useHoleTypeStats.ts
import { useMemo } from 'react';
import { useRounds } from './useRounds';
import { RoundsOptions, HoleTypeData } from './types';

export function useHoleTypeStats(options: RoundsOptions) {
  const { rounds = [], isLoading, error, refreshRounds } = useRounds(options);

  const holeTypeData = useMemo((): HoleTypeData | null => {
    // Check for both undefined and empty array
    if (!rounds || rounds.length === 0) return null;
    
    // Collect data for all holes
    const holeData: Record<number, any> = {};
    
    // Process all rounds and holes
    rounds.forEach(round => {
      if (!round.holes || round.holes.length === 0) return;
      
      round.holes.forEach((hole, index) => {
        const holeNumber = index + 1;
        
        if (!holeData[holeNumber]) {
          holeData[holeNumber] = {
            holeNumber,
            par: hole.par,
            averageScore: 0,
            averageScoreToPar: 0,
            totalHoles: 0,
            fairwayHits: 0,
            fairwayAttempts: 0,
            girHits: 0,
            girAttempts: 0,
            totalPutts: 0,
            eagles: 0,
            birdies: 0,
            pars: 0,
            bogeys: 0,
            doubleBogeys: 0,
            worseThanDouble: 0
          };
        }
        
        // Update hole data
        holeData[holeNumber].totalHoles++;
        holeData[holeNumber].averageScore += hole.score;
        holeData[holeNumber].averageScoreToPar += (hole.score - hole.par);
        
        // Update fairway stats (only for par 4s and 5s)
        if (hole.par >= 4) {
          holeData[holeNumber].fairwayAttempts++;
          if (hole.fairwayHit) {
            holeData[holeNumber].fairwayHits++;
          }
        }
        
        // Update GIR stats
        holeData[holeNumber].girAttempts++;
        if (hole.greenInRegulation) {
          holeData[holeNumber].girHits++;
        }
        
        // Update putting stats
        if (hole.putts) {
          holeData[holeNumber].totalPutts = (holeData[holeNumber].totalPutts || 0) + hole.putts;
        }
        
        // Update score type counts
        const scoreToPar = hole.score - hole.par;
        if (scoreToPar <= -2) {
          holeData[holeNumber].eagles++;
        } else if (scoreToPar === -1) {
          holeData[holeNumber].birdies++;
        } else if (scoreToPar === 0) {
          holeData[holeNumber].pars++;
        } else if (scoreToPar === 1) {
          holeData[holeNumber].bogeys++;
        } else if (scoreToPar === 2) {
          holeData[holeNumber].doubleBogeys++;
        } else {
          holeData[holeNumber].worseThanDouble++;
        }
      });
    });
    
    // Calculate averages
    Object.values(holeData).forEach(hole => {
      hole.averageScore = hole.averageScore / hole.totalHoles;
      hole.averageScoreToPar = hole.averageScoreToPar / hole.totalHoles;
      
      if (hole.totalPutts && hole.totalHoles) {
        hole.averagePutts = hole.totalPutts / hole.totalHoles;
      }
    });
    
    // Separate by hole type
    const par3Holes = Object.values(holeData).filter(h => h.par === 3);
    const par4Holes = Object.values(holeData).filter(h => h.par === 4);
    const par5Holes = Object.values(holeData).filter(h => h.par === 5);
    
    // Collect par-specific data from rounds
    const par3Scores: number[] = [];
    const par4Scores: number[] = [];
    const par5Scores: number[] = [];
    
    rounds.forEach(round => {
      if (!round.holes || round.holes.length === 0) return;
      
      round.holes.forEach(hole => {
        const scoreToPar = hole.score - hole.par;
        
        if (hole.par === 3) par3Scores.push(scoreToPar);
        else if (hole.par === 4) par4Scores.push(scoreToPar);
        else if (hole.par === 5) par5Scores.push(scoreToPar);
      });
    });
    
    // Calculate averages
    const avgPar3 = par3Scores.length > 0 
      ? par3Scores.reduce((sum, score) => sum + score, 0) / par3Scores.length 
      : null;
    
    const avgPar4 = par4Scores.length > 0 
      ? par4Scores.reduce((sum, score) => sum + score, 0) / par4Scores.length 
      : null;
    
    const avgPar5 = par5Scores.length > 0 
      ? par5Scores.reduce((sum, score) => sum + score, 0) / par5Scores.length 
      : null;
    
    // Calculate aggregate stats by par
    const calculateAggregateStats = (holes: any[]) => {
      if (!holes.length) return null;
      
      const totalHoles = holes.reduce((sum, h) => sum + h.totalHoles, 0);
      const totalScore = holes.reduce((sum, h) => sum + (h.averageScore * h.totalHoles), 0);
      const totalScoreToPar = holes.reduce((sum, h) => sum + (h.averageScoreToPar * h.totalHoles), 0);
      const totalFairwayHits = holes.reduce((sum, h) => sum + (h.fairwayHits || 0), 0);
      const totalFairwayAttempts = holes.reduce((sum, h) => sum + (h.fairwayAttempts || 0), 0);
      const totalGirHits = holes.reduce((sum, h) => sum + (h.girHits || 0), 0);
      const totalGirAttempts = holes.reduce((sum, h) => sum + (h.girAttempts || 0), 0);
      const totalPutts = holes.reduce((sum, h) => sum + (h.totalPutts || 0), 0);
      
      // Score distributions
      const eagles = holes.reduce((sum, h) => sum + h.eagles, 0);
      const birdies = holes.reduce((sum, h) => sum + h.birdies, 0);
      const pars = holes.reduce((sum, h) => sum + h.pars, 0);
      const bogeys = holes.reduce((sum, h) => sum + h.bogeys, 0);
      const doubleBogeys = holes.reduce((sum, h) => sum + h.doubleBogeys, 0);
      const worseThanDouble = holes.reduce((sum, h) => sum + h.worseThanDouble, 0);
      
      return {
        averageScore: totalScore / totalHoles,
        averageScoreToPar: totalScoreToPar / totalHoles,
        fairwayPercentage: totalFairwayAttempts > 0 ? (totalFairwayHits / totalFairwayAttempts) * 100 : null,
        girPercentage: totalGirAttempts > 0 ? (totalGirHits / totalGirAttempts) * 100 : 0,
        averagePutts: totalHoles > 0 ? totalPutts / totalHoles : 0,
        scoreDistribution: {
          eagles: eagles,
          birdies: birdies,
          pars: pars,
          bogeys: bogeys,
          doubleBogeys: doubleBogeys,
          worseThanDouble: worseThanDouble,
          total: eagles + birdies + pars + bogeys + doubleBogeys + worseThanDouble
        }
      };
    };
    
    const par3Stats = calculateAggregateStats(par3Holes);
    const par4Stats = calculateAggregateStats(par4Holes);
    const par5Stats = calculateAggregateStats(par5Holes);
    
    return { 
      par3: avgPar3, 
      par4: avgPar4, 
      par5: avgPar5,
      par3Stats,
      par4Stats,
      par5Stats,
      holePerformance: Object.values(holeData)
    };
  }, [rounds]);

  return {
    holeTypeData,
    rounds: rounds || [], // Ensure we return an array
    isLoading,
    error,
    refreshData: refreshRounds
  };
}
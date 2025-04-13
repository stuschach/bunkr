// src/lib/hooks/useProfileStats.ts
import { useState, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';
import { Scorecard } from '@/types/scorecard';
import { Achievement } from '@/components/profile/AchievementBadges';

export function useProfileStats(userId: string) {
  const [stats, setStats] = useState({
    roundsPlayed: 0,
    averageScore: null as number | null,
    bestScore: null as any,
    handicapHistory: [] as Array<{date: string, value: number}>,
    handicapTrend: 'stable' as 'improving' | 'declining' | 'stable',
    achievements: [] as Achievement[],
    advancedStats: {
      fairwaysHitPercentage: null as number | null,
      greensInRegulationPercentage: null as number | null,
      averagePuttsPerRound: null as number | null,
      averageDrivingDistance: null as number | null
    }
  });
  
  const loadStats = useCallback(async (profile: UserProfile) => {
    try {
      // Load rounds to calculate stats
      const roundsQuery = query(
        collection(db, 'scorecards'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(20)
      );
      
      const roundsSnapshot = await getDocs(roundsQuery);
      const rounds = roundsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scorecard[];
      
      // Calculate average score
      let averageScore = null;
      if (rounds.length > 0) {
        const totalScore = rounds.reduce((sum, round) => sum + round.totalScore, 0);
        averageScore = parseFloat((totalScore / rounds.length).toFixed(1));
      }
      
      // Find best round (lowest score to par)
      let bestScore = null;
      if (rounds.length > 0) {
        bestScore = rounds.reduce((best, current) => {
          const currentScoreToPar = current.totalScore - current.coursePar;
          const bestScoreToPar = best ? (best.score - best.par) : Infinity;
          
          if (best === null || currentScoreToPar < bestScoreToPar) {
            return {
              score: current.totalScore,
              scoreToPar: currentScoreToPar,
              course: current.courseName,
              date: current.date,
              par: current.coursePar
            };
          }
          return best;
        }, null as any);
      }
      
      // Calculate advanced stats
      let fairwaysHit = 0;
      let fairwaysTotal = 0;
      let greensInReg = 0;
      let totalHoles = 0;
      let totalPutts = 0;
      let drivingDistanceSum = 0;
      let drivingDistanceCount = 0;
      
      rounds.forEach(round => {
        if (round.stats) {
          // Fairways hit
          if (typeof round.stats.fairwaysHit === 'number' && typeof round.stats.fairwaysTotal === 'number') {
            fairwaysHit += round.stats.fairwaysHit;
            fairwaysTotal += round.stats.fairwaysTotal;
          }
          
          // Greens in regulation
          if (typeof round.stats.greensInRegulation === 'number') {
            greensInReg += round.stats.greensInRegulation;
            totalHoles += 18;
          }
          
          // Putts
          if (typeof round.stats.totalPutts === 'number') {
            totalPutts += round.stats.totalPutts;
          }
          
          // Driving distance
          if (typeof round.stats.averageDrivingDistance === 'number') {
            drivingDistanceSum += round.stats.averageDrivingDistance;
            drivingDistanceCount++;
          }
        }
      });
      
      // Generate sample handicap history for demo purposes
      // In a real app, this would come from a database
      const now = new Date();
      const handicapHistory = [];
      const baseHandicap = profile.handicapIndex !== null ? profile.handicapIndex : 15;
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(now.getMonth() - i);
        
        const variation = Math.random() * 1.5 - 0.75; // Random variation between -0.75 and 0.75
        const improvement = 0.2 * i; // Slight improvement over time
        
        const value = baseHandicap - improvement + variation;
        
        handicapHistory.push({
          date: date.toISOString().split('T')[0],
          value: parseFloat(value.toFixed(1))
        });
      }
      
      // Determine handicap trend
      let handicapTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (handicapHistory.length >= 2) {
        const current = handicapHistory[handicapHistory.length - 1].value;
        const previous = handicapHistory[handicapHistory.length - 2].value;
        
        if (current < previous - 0.3) {
          handicapTrend = 'improving';
        } else if (current > previous + 0.3) {
          handicapTrend = 'declining';
        }
      }
      
      // Generate sample achievements based on handicap and rounds played
      const achievements: Achievement[] = [];
      
      // Based on handicap
      if (profile.handicapIndex !== null) {
        if (profile.handicapIndex < 5) {
          achievements.push({
            id: 'scratch-golfer',
            name: 'Scratch Golfer',
            description: 'Achieve a handicap index below 5',
            icon: '🏆',
            dateEarned: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            category: 'skill',
            rarity: 'legendary'
          });
        } else if (profile.handicapIndex < 10) {
          achievements.push({
            id: 'single-digit',
            name: 'Single Digit Handicap',
            description: 'Achieve a handicap index below 10',
            icon: '⛳',
            dateEarned: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            category: 'skill',
            rarity: 'rare'
          });
        }
      }
      
      // Based on rounds played
      if (rounds.length >= 10) {
        achievements.push({
          id: 'dedicated-golfer',
          name: 'Dedicated Golfer',
          description: 'Log 10 or more rounds',
          icon: '🏌️',
          dateEarned: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          category: 'progress',
          rarity: 'common'
        });
      }
      
      if (rounds.length >= 25) {
        achievements.push({
          id: 'golf-enthusiast',
          name: 'Golf Enthusiast',
          description: 'Log 25 or more rounds',
          icon: '🌟',
          dateEarned: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          category: 'progress',
          rarity: 'uncommon'
        });
      }
      
      // Update stats state
      setStats({
        roundsPlayed: rounds.length,
        averageScore,
        bestScore,
        handicapHistory,
        handicapTrend,
        achievements,
        advancedStats: {
          fairwaysHitPercentage: fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : null,
          greensInRegulationPercentage: totalHoles > 0 ? (greensInReg / totalHoles) * 100 : null,
          averagePuttsPerRound: rounds.length > 0 ? totalPutts / rounds.length : null,
          averageDrivingDistance: drivingDistanceCount > 0 ? Math.round(drivingDistanceSum / drivingDistanceCount) : null
        }
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [userId]);
  
  return { stats, loadStats };
}
// src/lib/hooks/stats/types.ts
import { Scorecard } from '@/types/scorecard';

export interface RoundsOptions {
  userId: string;
  timeRange?: 'all' | 'last30' | 'last90' | 'thisYear';
  courseId?: string;
  limit?: number;
  includeIncomplete?: boolean;
}

export interface HandicapHistoryPoint {
  date: string;
  handicap: number | null;
  roundCount: number;
}

export interface HandicapData {
  history: HandicapHistoryPoint[];
  current: number | null;
  trend: 'improving' | 'declining' | 'stable';
  countingRounds: Scorecard[];
  potential?: number | null;
}

export interface ScoreDataPoint {
  date: string;
  score: number;
  par: number;
  scoreToPar: number;
  courseId: string | undefined;
  courseName: string;
}

export interface ScoreDistributionPoint {
  scoreToPar: number;
  count: number;
  percentage: number;
}

export interface ScoringData {
  trend: ScoreDataPoint[];
  distribution: ScoreDistributionPoint[];
  averageScore: number | null;
  bestRound: Scorecard | null;
  scoringTrend: number;
}

export interface HoleTypeData {
  par3: number | null;
  par4: number | null;
  par5: number | null;
  par3Stats?: any;
  par4Stats?: any;
  par5Stats?: any;
  holePerformance?: any[];
}

export interface PerformanceData {
  fairwaysHitPercentage: number;
  greensInRegulationPercentage: number;
  puttsPerRound: number;
  averageDrivingDistance: number | null;
  roundsWithStats: number;
  bestHole?: {
    holeNumber: number;
    avgScoreToPar: number;
  } | null;
  worstHole?: {
    holeNumber: number;
    avgScoreToPar: number;
  } | null;
}

export interface OverviewStats {
  totalRounds: number;
  roundsThisYear: number;
  handicapIndex: number | null;
  avgScore: number | null;
  scoringTrend: number;
  bestRound: Scorecard | null;
  firPercent: number;
  girPercent: number;
  puttsPerRound: number;
}
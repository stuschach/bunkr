// src/lib/contexts/StatsContext.tsx
import React, { createContext, useContext } from 'react';
import { Scorecard } from '@/types/scorecard';
import { 
  useRounds, 
  useHandicapStats, 
  useScoringStats, 
  useHoleTypeStats,
  usePerformanceStats,
  useOverviewStats,
  OverviewStats,
  HandicapData,
  ScoringData,
  HoleTypeData,
  PerformanceData
} from '@/lib/hooks/stats';

interface StatsContextType {
  rounds: Scorecard[];
  overviewStats: OverviewStats | null;
  handicapData: HandicapData | null;
  scoringData: ScoringData | null;
  holeTypeData: HoleTypeData | null;
  performanceData: PerformanceData | null;
  isLoading: boolean;
  error: string | null;
  refreshStats: () => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export function StatsProvider({ 
  children, 
  userId,
  includeIncomplete = false
}: { 
  children: React.ReactNode, 
  userId: string,
  includeIncomplete?: boolean
}) {
  // Options for all stats hooks
  const options = { 
    userId, 
    includeIncomplete,
    limit: 100 // Adjust as needed
  };
  
  // Use base hook to get rounds data
  const { 
    rounds = [], // Provide default empty array
    isLoading: isLoadingRounds, 
    error: roundsError,
    refreshRounds
  } = useRounds(options);
  
  // Use specialized hooks for different stat categories
  const { overviewStats, isLoading: isLoadingOverview } = useOverviewStats(options);
  const { handicapData, isLoading: isLoadingHandicap } = useHandicapStats(options);
  const { scoringData, isLoading: isLoadingScoring } = useScoringStats(options);
  const { holeTypeData, isLoading: isLoadingHoleTypes } = useHoleTypeStats(options);
  const { performanceData, isLoading: isLoadingPerformance } = usePerformanceStats(options);
  
  // Combine loading states
  const isLoading = isLoadingRounds || isLoadingOverview || isLoadingHandicap || 
                    isLoadingScoring || isLoadingHoleTypes || isLoadingPerformance;
  
  const error = roundsError; // Could combine errors if needed
  
  const value = {
    rounds: rounds || [], // Ensure we always have an array
    overviewStats,
    handicapData,
    scoringData,
    holeTypeData,
    performanceData,
    isLoading,
    error,
    refreshStats: refreshRounds
  };
  
  return (
    <StatsContext.Provider value={value}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  
  if (context === undefined) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  
  return context;
}
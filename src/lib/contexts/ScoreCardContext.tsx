// src/lib/contexts/ScoreCardContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { 
  ScorecardService, 
  ScorecardError, 
  ScorecardErrorType,
  ScorecardFilter,
  ScorecardOptions,
  ScorecardListResult
} from '@/lib/services/ScorecardService';
import { Scorecard, HoleData, TeeBox } from '@/types/scorecard';

/**
 * States for the scorecard operations
 */
export type OperationState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Context state interface
 */
interface ScorecardContextState {
  // Current scorecard
  currentScorecard: Scorecard | null;
  setCurrentScorecard: (scorecard: Scorecard | null) => void;
  
  // Scorecard lists
  userScorecards: Scorecard[];
  recentScorecards: Scorecard[];
  
  // Loading states
  loadingState: OperationState;
  savingState: OperationState;
  deleteState: OperationState;
  listLoadingState: OperationState;
  
  // Error state
  error: Error | null;
  clearError: () => void;
  
  // Operations
  loadScorecard: (scorecardId: string) => Promise<Scorecard | null>;
  createScorecard: (data: Partial<Scorecard>, options?: ScorecardOptions) => Promise<Scorecard | null>;
  updateScorecard: (scorecardId: string, data: Partial<Scorecard>, options?: ScorecardOptions) => Promise<Scorecard | null>;
  deleteScorecard: (scorecardId: string) => Promise<boolean>;
  updateHoleData: (scorecardId: string, holeNumber: number, data: Partial<HoleData>) => Promise<Scorecard | null>;
  completeScorecard: (scorecardId: string, options?: { shareToFeed?: boolean, message?: string }) => Promise<Scorecard | null>;
  
  // List operations
  loadUserScorecards: (userId?: string, filter?: Partial<ScorecardFilter>) => Promise<ScorecardListResult | null>;
  loadMoreUserScorecards: () => Promise<boolean>;
  
  // Utility functions
  calculateStats: (holes: HoleData[]) => any;
  getCourseHandicap: (courseId: string, teeBox: TeeBox) => Promise<number | null>;
  
  // Pagination
  hasMoreScorecards: boolean;
  refreshScorecards: () => Promise<void>;
}

// Create the context
const ScorecardContext = createContext<ScorecardContextState | undefined>(undefined);

/**
 * Provider props
 */
interface ScorecardProviderProps {
  children: React.ReactNode;
  initialScorecard?: Scorecard | null;
}

/**
 * Scorecard Context Provider
 */
export const ScorecardProvider: React.FC<ScorecardProviderProps> = ({ 
  children,
  initialScorecard = null
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  
  // State for current scorecard
  const [currentScorecard, setCurrentScorecard] = useState<Scorecard | null>(initialScorecard);
  
  // State for scorecard lists
  const [userScorecards, setUserScorecards] = useState<Scorecard[]>([]);
  const [recentScorecards, setRecentScorecards] = useState<Scorecard[]>([]);
  
  // Pagination state
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMoreScorecards, setHasMoreScorecards] = useState<boolean>(false);
  const [currentFilter, setCurrentFilter] = useState<ScorecardFilter>({});
  
  // Operation states
  const [loadingState, setLoadingState] = useState<OperationState>('idle');
  const [savingState, setSavingState] = useState<OperationState>('idle');
  const [deleteState, setDeleteState] = useState<OperationState>('idle');
  const [listLoadingState, setListLoadingState] = useState<OperationState>('idle');
  
  // Error state
  const [error, setError] = useState<Error | null>(null);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Handle errors
  const handleError = useCallback((error: any) => {
    setError(error);
    
    // Show notification for user-facing errors
    if (error instanceof ScorecardError) {
      let title = 'Error';
      let description = error.message;
      
      switch (error.type) {
        case ScorecardErrorType.NOT_FOUND:
          title = 'Scorecard Not Found';
          break;
        case ScorecardErrorType.UNAUTHORIZED:
          title = 'Unauthorized';
          break;
        case ScorecardErrorType.VALIDATION_ERROR:
          title = 'Validation Error';
          break;
        case ScorecardErrorType.NETWORK_ERROR:
          title = 'Network Error';
          description = 'Please check your internet connection and try again.';
          break;
      }
      
      showNotification({
        type: 'error',
        title,
        description
      });
    } else {
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.'
      });
    }
    
    return error;
  }, [showNotification]);
  
  /**
   * Load a single scorecard
   */
  const loadScorecard = useCallback(async (scorecardId: string): Promise<Scorecard | null> => {
    if (!scorecardId) return null;
    
    setLoadingState('loading');
    clearError();
    
    try {
      const scorecard = await ScorecardService.getScorecard(scorecardId, user?.uid);
      setCurrentScorecard(scorecard);
      setLoadingState('success');
      return scorecard;
    } catch (error) {
      setLoadingState('error');
      handleError(error);
      return null;
    }
  }, [user, clearError, handleError]);
  
  /**
   * Create a new scorecard
   */
  const createScorecard = useCallback(async (
    data: Partial<Scorecard>,
    options?: ScorecardOptions
  ): Promise<Scorecard | null> => {
    if (!user) {
      handleError(new ScorecardError(
        'You must be logged in to create a scorecard',
        ScorecardErrorType.UNAUTHORIZED
      ));
      return null;
    }
    
    setSavingState('loading');
    clearError();
    
    try {
      // Optimistic UI update for better responsiveness
      if (currentScorecard) {
        // If we have a current scorecard, update it with the new data
        // This helps with live scoring where we update frequently
        const optimisticScorecard = {
          ...currentScorecard,
          ...data,
          updatedAt: new Date()
        };
        setCurrentScorecard(optimisticScorecard);
      }
      
      const scorecard = await ScorecardService.createScorecard(data, user.uid, options);
      
      // Update the current scorecard
      setCurrentScorecard(scorecard);
      
      // Add to user scorecards if needed
      if (!options?.saveAsDraft) {
        setUserScorecards(prev => [scorecard, ...prev]);
      }
      
      setSavingState('success');
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Scorecard Created',
        description: 'Your scorecard has been created successfully.'
      });
      
      return scorecard;
    } catch (error) {
      setSavingState('error');
      handleError(error);
      return null;
    }
  }, [user, currentScorecard, clearError, handleError, showNotification]);
  
  /**
   * Update an existing scorecard
   */
  const updateScorecard = useCallback(async (
    scorecardId: string,
    data: Partial<Scorecard>,
    options?: ScorecardOptions
  ): Promise<Scorecard | null> => {
    if (!user) {
      handleError(new ScorecardError(
        'You must be logged in to update a scorecard',
        ScorecardErrorType.UNAUTHORIZED
      ));
      return null;
    }
    
    setSavingState('loading');
    clearError();
    
    try {
      // Optimistic UI update
      if (currentScorecard && currentScorecard.id === scorecardId) {
        const optimisticScorecard = {
          ...currentScorecard,
          ...data,
          updatedAt: new Date()
        };
        setCurrentScorecard(optimisticScorecard);
      }
      
      const scorecard = await ScorecardService.updateScorecard(
        scorecardId,
        data,
        user.uid,
        options
      );
      
      // Update the current scorecard
      setCurrentScorecard(scorecard);
      
      // Update the scorecard in the list if it exists
      setUserScorecards(prev => prev.map(sc => 
        sc.id === scorecardId ? scorecard : sc
      ));
      
      setSavingState('success');
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Scorecard Updated',
        description: 'Your scorecard has been updated successfully.'
      });
      
      return scorecard;
    } catch (error) {
      setSavingState('error');
      handleError(error);
      return null;
    }
  }, [user, currentScorecard, clearError, handleError, showNotification]);
  
  /**
   * Delete a scorecard
   */
  const deleteScorecard = useCallback(async (scorecardId: string): Promise<boolean> => {
    if (!user) {
      handleError(new ScorecardError(
        'You must be logged in to delete a scorecard',
        ScorecardErrorType.UNAUTHORIZED
      ));
      return false;
    }
    
    setDeleteState('loading');
    clearError();
    
    try {
      await ScorecardService.deleteScorecard(scorecardId, user.uid);
      
      // Remove from current scorecard if needed
      if (currentScorecard && currentScorecard.id === scorecardId) {
        setCurrentScorecard(null);
      }
      
      // Remove from scorecard lists
      setUserScorecards(prev => prev.filter(sc => sc.id !== scorecardId));
      setRecentScorecards(prev => prev.filter(sc => sc.id !== scorecardId));
      
      setDeleteState('success');
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Scorecard Deleted',
        description: 'Your scorecard has been deleted successfully.'
      });
      
      return true;
    } catch (error) {
      setDeleteState('error');
      handleError(error);
      return false;
    }
  }, [user, currentScorecard, clearError, handleError, showNotification]);
  
  /**
   * Update a specific hole in a scorecard
   */
  const updateHoleData = useCallback(async (
    scorecardId: string,
    holeNumber: number,
    data: Partial<HoleData>
  ): Promise<Scorecard | null> => {
    if (!user) {
      handleError(new ScorecardError(
        'You must be logged in to update hole data',
        ScorecardErrorType.UNAUTHORIZED
      ));
      return null;
    }
    
    setSavingState('loading');
    clearError();
    
    try {
      // Optimistic UI update
      if (currentScorecard && currentScorecard.id === scorecardId) {
        const updatedHoles = [...currentScorecard.holes];
        const holeIndex = holeNumber - 1;
        
        updatedHoles[holeIndex] = {
          ...updatedHoles[holeIndex],
          ...data
        };
        
        // Calculate new stats
        const stats = ScorecardService.calculateStats(updatedHoles);
        
        // Update current scorecard
        const optimisticScorecard = {
          ...currentScorecard,
          holes: updatedHoles,
          stats,
          totalScore: stats.totalScore,
          scoreToPar: stats.totalScore - currentScorecard.coursePar,
          updatedAt: new Date()
        };
        
        setCurrentScorecard(optimisticScorecard);
      }
      
      // Call the service
      const scorecard = await ScorecardService.updateHoleData(
        scorecardId,
        holeNumber,
        data,
        user.uid
      );
      
      // Update current scorecard with actual data
      setCurrentScorecard(scorecard);
      
      // Update the scorecard in the list if it exists
      setUserScorecards(prev => prev.map(sc => 
        sc.id === scorecardId ? scorecard : sc
      ));
      
      setSavingState('success');
      return scorecard;
    } catch (error) {
      setSavingState('error');
      handleError(error);
      return null;
    }
  }, [user, currentScorecard, clearError, handleError]);
  
  /**
   * Complete a scorecard (finish a round)
   */
  const completeScorecard = useCallback(async (
    scorecardId: string,
    options?: { shareToFeed?: boolean, message?: string }
  ): Promise<Scorecard | null> => {
    if (!user) {
      handleError(new ScorecardError(
        'You must be logged in to complete a scorecard',
        ScorecardErrorType.UNAUTHORIZED
      ));
      return null;
    }
    
    setSavingState('loading');
    clearError();
    
    try {
      const scorecard = await ScorecardService.completeScorecard(
        scorecardId,
        user.uid,
        options
      );
      
      // Update current scorecard
      setCurrentScorecard(scorecard);
      
      // Update the scorecard in the list if it exists
      setUserScorecards(prev => prev.map(sc => 
        sc.id === scorecardId ? scorecard : sc
      ));
      
      setSavingState('success');
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Round Completed',
        description: options?.shareToFeed
          ? 'Your round has been completed and shared to your feed.'
          : 'Your round has been completed successfully.'
      });
      
      return scorecard;
    } catch (error) {
      setSavingState('error');
      handleError(error);
      return null;
    }
  }, [user, clearError, handleError, showNotification]);
  
  /**
   * Load user scorecards
   */
  const loadUserScorecards = useCallback(async (
    userId?: string,
    filter?: Partial<ScorecardFilter>
  ): Promise<ScorecardListResult | null> => {
    const targetUserId = userId || user?.uid;
    
    if (!targetUserId) {
      setUserScorecards([]);
      return null;
    }
    
    setListLoadingState('loading');
    clearError();
    
    try {
      const fullFilter: ScorecardFilter = {
        userId: targetUserId,
        sortBy: 'date',
        sortDirection: 'desc',
        limit: 10,
        ...filter
      };
      
      // Save current filter for pagination
      setCurrentFilter(fullFilter);
      
      const result = await ScorecardService.getScorecards(fullFilter);
      
      setUserScorecards(result.scorecards);
      setLastVisible(result.lastVisible);
      setHasMoreScorecards(result.hasMore);
      setListLoadingState('success');
      
      return result;
    } catch (error) {
      setListLoadingState('error');
      handleError(error);
      return null;
    }
  }, [user, clearError, handleError]);
  
  /**
   * Load more user scorecards (pagination)
   */
  const loadMoreUserScorecards = useCallback(async (): Promise<boolean> => {
    if (!user || !lastVisible || !hasMoreScorecards) {
      return false;
    }
    
    setListLoadingState('loading');
    
    try {
      const fullFilter: ScorecardFilter = {
        ...currentFilter,
        lastVisible
      };
      
      const result = await ScorecardService.getScorecards(fullFilter);
      
      setUserScorecards(prev => [...prev, ...result.scorecards]);
      setLastVisible(result.lastVisible);
      setHasMoreScorecards(result.hasMore);
      setListLoadingState('success');
      
      return true;
    } catch (error) {
      setListLoadingState('error');
      handleError(error);
      return false;
    }
  }, [user, lastVisible, hasMoreScorecards, currentFilter, handleError]);
  
  /**
   * Refresh scorecards list
   */
  const refreshScorecards = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      await loadUserScorecards(user.uid);
    } catch (error) {
      handleError(error);
    }
  }, [user, loadUserScorecards, handleError]);
  
  /**
   * Get course handicap for the current user
   */
  const getCourseHandicap = useCallback(async (
    courseId: string,
    teeBox: TeeBox
  ): Promise<number | null> => {
    if (!user) return null;
    
    try {
      return await ScorecardService.getCourseHandicap(user.uid, courseId, teeBox);
    } catch (error) {
      console.error('Error getting course handicap:', error);
      return null;
    }
  }, [user]);
  
  /**
   * Calculate statistics for a set of holes
   */
  const calculateStats = useCallback((holes: HoleData[]): any => {
    return ScorecardService.calculateStats(holes);
  }, []);
  
  // Load user scorecards on mount if user is logged in
  useEffect(() => {
    if (user && userScorecards.length === 0 && listLoadingState === 'idle') {
      loadUserScorecards(user.uid);
    }
  }, [user, userScorecards.length, listLoadingState, loadUserScorecards]);
  
  // Context value
  const value = useMemo(() => ({
    // Current scorecard
    currentScorecard,
    setCurrentScorecard,
    
    // Scorecard lists
    userScorecards,
    recentScorecards,
    
    // Loading states
    loadingState,
    savingState,
    deleteState,
    listLoadingState,
    
    // Error state
    error,
    clearError,
    
    // Operations
    loadScorecard,
    createScorecard,
    updateScorecard,
    deleteScorecard,
    updateHoleData,
    completeScorecard,
    
    // List operations
    loadUserScorecards,
    loadMoreUserScorecards,
    
    // Utility functions
    calculateStats,
    getCourseHandicap,
    
    // Pagination
    hasMoreScorecards,
    refreshScorecards
  }), [
    currentScorecard, setCurrentScorecard,
    userScorecards, recentScorecards,
    loadingState, savingState, deleteState, listLoadingState,
    error, clearError,
    loadScorecard, createScorecard, updateScorecard, deleteScorecard,
    updateHoleData, completeScorecard,
    loadUserScorecards, loadMoreUserScorecards,
    calculateStats, getCourseHandicap,
    hasMoreScorecards, refreshScorecards
  ]);
  
  return (
    <ScorecardContext.Provider value={value}>
      {children}
    </ScorecardContext.Provider>
  );
};

/**
 * Hook to use the scorecard context
 */
export const useScorecard = () => {
  const context = useContext(ScorecardContext);
  
  if (context === undefined) {
    throw new Error('useScorecard must be used within a ScorecardProvider');
  }
  
  return context;
};

/**
 * Specialized hook for live scoring
 */
export const useLiveScoring = (scorecardId?: string) => {
  const {
    currentScorecard,
    loadScorecard,
    updateHoleData,
    completeScorecard,
    loadingState,
    savingState,
    error,
    clearError
  } = useScorecard();
  
  const { user } = useAuth();
  
  // State to track initialization
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Load the scorecard if an ID is provided
  useEffect(() => {
    const fetchScorecard = async () => {
      if (scorecardId && !currentScorecard && loadingState === 'idle') {
        loadScorecard(scorecardId);
      } else if (scorecardId && currentScorecard && currentScorecard.id !== scorecardId) {
        loadScorecard(scorecardId);
      } else if (currentScorecard) {
        setIsInitialized(true);
      }
    };
    
    fetchScorecard();
  }, [scorecardId, currentScorecard, loadingState, loadScorecard]);
  
  // Update a hole's score
  const updateHoleScore = useCallback((
    holeNumber: number,
    score: number
  ) => {
    if (!scorecardId && !currentScorecard) return;
    
    const targetId = scorecardId || currentScorecard?.id;
    if (!targetId) return;
    
    // First validate the data
    if (holeNumber < 1 || holeNumber > 18 || score < 0) {
      console.error('Invalid hole data:', holeNumber, score);
      return;
    }
    
    return updateHoleData(targetId, holeNumber, { score });
  }, [scorecardId, currentScorecard, updateHoleData]);
  
  // Complete the round
  const finishRound = useCallback((
    shareToFeed: boolean = true,
    message?: string
  ) => {
    if (!scorecardId && !currentScorecard) return;
    
    const targetId = scorecardId || currentScorecard?.id;
    if (!targetId) return;
    
    return completeScorecard(targetId, { shareToFeed, message });
  }, [scorecardId, currentScorecard, completeScorecard]);
  
  // Make sure the scorecard has valid holes
  const validatedScorecard = useMemo(() => {
    if (!currentScorecard) return null;
    
    // Check if holes array is valid
    if (!currentScorecard.holes || !Array.isArray(currentScorecard.holes) || currentScorecard.holes.length === 0) {
      // Create default holes if missing
      return {
        ...currentScorecard,
        holes: Array.from({ length: 18 }, (_, i) => ({
          number: i + 1,
          par: 4, // Default par value
          score: 0,
          fairwayHit: null,
          greenInRegulation: false,
          putts: 0,
          penalties: 0
        }))
      };
    }
    
    // Make sure we have 18 holes
    if (currentScorecard.holes.length < 18) {
      const holes = [...currentScorecard.holes];
      
      // Add missing holes
      while (holes.length < 18) {
        const holeNumber = holes.length + 1;
        holes.push({
          number: holeNumber,
          par: 4,
          score: 0,
          fairwayHit: null,
          greenInRegulation: false,
          putts: 0,
          penalties: 0
        });
      }
      
      return {
        ...currentScorecard,
        holes
      };
    }
    
    return currentScorecard;
  }, [currentScorecard]);
  
  return {
    scorecard: validatedScorecard,
    isLoading: loadingState === 'loading' || !isInitialized,
    isSaving: savingState === 'loading',
    error,
    clearError,
    updateHoleData,
    updateHoleScore,
    finishRound,
    retryLoading: useCallback(() => {
      if (scorecardId) {
        clearError();
        return loadScorecard(scorecardId);
      }
      return Promise.resolve(null);
    }, [scorecardId, loadScorecard, clearError]),
    isOwner: currentScorecard?.userId === user?.uid
  };
};

/**
 * Hook to use with the scorecard form
 */
export const useScorecardForm = (scorecardId?: string) => {
  const {
    currentScorecard,
    loadScorecard,
    createScorecard,
    updateScorecard,
    loadingState,
    savingState,
    error
  } = useScorecard();
  
  // Load the scorecard if an ID is provided
  useEffect(() => {
    if (scorecardId && !currentScorecard && loadingState === 'idle') {
      loadScorecard(scorecardId);
    }
  }, [scorecardId, currentScorecard, loadingState, loadScorecard]);
  
  // Save the scorecard (create or update)
  const saveScorecard = useCallback((
    data: Partial<Scorecard>,
    options?: ScorecardOptions
  ) => {
    if (scorecardId) {
      return updateScorecard(scorecardId, data, options);
    } else {
      return createScorecard(data, options);
    }
  }, [scorecardId, createScorecard, updateScorecard]);
  
  return {
    scorecard: currentScorecard,
    isLoading: loadingState === 'loading',
    isSaving: savingState === 'loading',
    error,
    saveScorecard
  };
};

export default ScorecardContext;
// src/lib/hooks/useLiveScoring.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useScorecard } from "../contexts/ScoreCardContext";

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
    const [loadAttempts, setLoadAttempts] = useState<number>(0);
    const [lastError, setLastError] = useState<Error | null>(null);
    
    // Load the scorecard if an ID is provided
    useEffect(() => {
      const fetchScorecard = async () => {
        if (!scorecardId) {
          setIsInitialized(true);
          return;
        }
        
        if ((!currentScorecard || currentScorecard.id !== scorecardId) && loadingState !== 'loading') {
          try {
            const result = await loadScorecard(scorecardId);
            setIsInitialized(true);
            if (!result) {
              setLastError(new Error('Failed to load scorecard'));
            }
          } catch (err) {
            console.error('Error loading scorecard:', err);
            setLastError(err instanceof Error ? err : new Error('Unknown error loading scorecard'));
          }
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
      if (!scorecardId && !currentScorecard) return null;
      
      const targetId = scorecardId || currentScorecard?.id;
      if (!targetId) return null;
      
      // First validate the data
      if (holeNumber < 1 || holeNumber > 18 || score < 0) {
        console.error('Invalid hole data:', holeNumber, score);
        return null;
      }
      
      return updateHoleData(targetId, holeNumber, { score });
    }, [scorecardId, currentScorecard, updateHoleData]);
    
    // Complete the round
    const finishRound = useCallback((
      shareToFeed: boolean = true,
      message?: string
    ) => {
      if (!scorecardId && !currentScorecard) return null;
      
      const targetId = scorecardId || currentScorecard?.id;
      if (!targetId) return null;
      
      return completeScorecard(targetId, { shareToFeed, message });
    }, [scorecardId, currentScorecard, completeScorecard]);
    
    // Function to retry loading
    const retryLoading = useCallback(() => {
      if (!scorecardId) return;
      
      // Clear any previous errors
      clearError();
      setLastError(null);
      
      // Increment attempts counter
      setLoadAttempts(prev => prev + 1);
      
      // Try loading again
      return loadScorecard(scorecardId);
    }, [scorecardId, loadScorecard, clearError]);
    
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
    
    // Combine errors
    const combinedError = error || lastError;
    
    return {
      scorecard: validatedScorecard,
      isLoading: loadingState === 'loading' || !isInitialized,
      isSaving: savingState === 'loading',
      error: combinedError,
      clearError: useCallback(() => {
        clearError();
        setLastError(null);
      }, [clearError]),
      updateHoleData,
      updateHoleScore,
      finishRound,
      retryLoading,
      loadAttempts,
      isOwner: currentScorecard?.userId === user?.uid
    };
};

export default useLiveScoring;
// src/components/scorecard/LiveScoring/LiveScorecard.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveScoring, ScorecardProvider } from '@/lib/contexts/ScoreCardContext';
import { ScorecardService } from '@/lib/services/ScorecardService';
import { CourseService } from '@/lib/services/CourseService';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { useCourse, useCourseHoles } from '@/lib/hooks/useCourse';
import { LiveHoleView } from './LiveHoleView';
import { ScoreInput } from './ScoreInput';
import { LiveStats } from './LiveStats';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { ErrorBoundary } from '@/components/common/feedback/ErrorBoundary';
import { Scorecard, HoleData } from '@/types/scorecard';
import { cacheService, CacheOperationPriority, CACHE_KEYS, CACHE_TTL } from '@/lib/services/CacheService';

interface LiveScorecardProps {
  scorecardId?: string;
  initialData?: Partial<Scorecard>;
}

// Create a wrapper component that provides the ScorecardContext
export function LiveScorecard(props: LiveScorecardProps) {
  return (
    <ScorecardProvider initialScorecard={null}>
      <ErrorBoundary
        fallback={<LiveScorecardError />}
      >
        <LiveScorecardContent {...props} />
      </ErrorBoundary>
    </ScorecardProvider>
  );
}

// Error fallback component
function LiveScorecardError() {
  const router = useRouter();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md mb-4 max-w-md">
        <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
        <p className="mb-4">We encountered an error while loading or processing the scorecard. Please try again.</p>
      </div>
      <Button onClick={() => router.push('/scorecard')}>
        Back to Scorecards
      </Button>
    </div>
  );
}

// Main component implementation
function LiveScorecardContent({ 
  scorecardId,
  initialData 
}: LiveScorecardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  
  // Context variables for scorecard management
  const { 
    scorecard: currentScorecard, 
    updateHoleData,
    completeScorecard,
    loadingState,
    savingState,
    error,
    updateHoleScore,
    finishRound,
    clearError
  } = useLiveScoring(scorecardId);

  // State for current hole
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [holeDateLoadAttempts, setHoleDataLoadAttempts] = useState<number>(0);
  const [isCreatingNewScorecard, setIsCreatingNewScorecard] = useState<boolean>(false);
  
  // Add derived state variables for loading states
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Use effects to update loading states from context
  useEffect(() => {
    setIsLoadingScorecard(loadingState === 'loading');
  }, [loadingState]);
  
  useEffect(() => {
    setIsSaving(savingState === 'loading');
  }, [savingState]);
  
  // Use our course hooks to efficiently load holes data
  const { 
    holes: courseHoles, 
    isLoading: isLoadingCourseHoles,
    error: courseHolesError,
    refresh: refreshCourseHoles
  } = useCourseHoles(initialData?.courseId || currentScorecard?.courseId);
  
  // Initialize empty holes with proper par values
  const createEmptyHoles = useCallback((holeDataFromCourse: any[] = []): HoleData[] => {
    // Create default holes with par 4
    const defaultHoles: HoleData[] = Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4,
      score: 0,
      fairwayHit: null,
      greenInRegulation: false,
      putts: 0,
      penalties: 0
    }));
    
    // If we have hole data from the course, use it to update pars
    if (holeDataFromCourse && holeDataFromCourse.length > 0) {
      return defaultHoles.map((hole, index) => {
        if (index < holeDataFromCourse.length) {
          return {
            ...hole,
            par: holeDataFromCourse[index].par || 4
          };
        }
        return hole;
      });
    }
    
    return defaultHoles;
  }, []);
  
  // Load course holes with retries
  const loadCourseHoleDataWithRetry = useCallback(async (courseId: string, maxRetries = 3) => {
    if (!courseId) return [];
    
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // Try to get from cache first with CRITICAL priority
        const cacheKey = CACHE_KEYS.COURSE_HOLES(courseId);
        const cachedHoles = await cacheService.get<HoleData[]>(
          cacheKey,
          CacheOperationPriority.CRITICAL
        );
        
        if (cachedHoles && Array.isArray(cachedHoles) && cachedHoles.length > 0) {
          console.log('Using cached hole data for course:', courseId);
          return cachedHoles;
        }
        
        console.log(`Fetching hole data for course ${courseId} (attempt ${retries + 1})`);
        
        // Load from CourseService
        const holeData = await CourseService.getCourseHoles(courseId);
        
        // Cache the result with CRITICAL priority
        if (holeData && Array.isArray(holeData) && holeData.length > 0) {
          await cacheService.set(
            cacheKey,
            holeData,
            { ttl: CACHE_TTL.COURSE },
            CacheOperationPriority.CRITICAL
          );
          
          return holeData;
        }
        
        // If we get here, the hole data wasn't properly loaded
        throw new Error("Failed to load valid hole data");
      } catch (error) {
        console.error(`Error loading course hole data (attempt ${retries + 1}):`, error);
        retries++;
        
        // Wait before retry with exponential backoff
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retries)));
        }
      }
    }
    
    console.warn("All attempts to load hole data failed, returning defaults");
    // Return default holes if all retries failed
    return [];
  }, []);

  // Retry loading the scorecard
  const retryLoading = useCallback(() => {
    if (error) {
      clearError();
    }
    
    if (scorecardId) {
      // If we have a scorecardId, try to reload it
      window.location.reload();
    } else if (initialData) {
      // Try creating a new scorecard again
      setIsCreatingNewScorecard(false);
      createNewScorecard();
    }
  }, [error, clearError, scorecardId, initialData]);

  // Initialize a new scorecard if we don't have an ID
  const createNewScorecard = useCallback(async () => {
    if (!user || isCreatingNewScorecard || scorecardId || !initialData) return;
    
    setIsCreatingNewScorecard(true);
    
    try {
      console.log('Creating new live scorecard with initial data:', initialData);
      
      // Pre-load hole data for better reliability
      let courseHoleData: any[] = [];
      if (initialData.courseId) {
        setHoleDataLoadAttempts(prev => prev + 1);
        courseHoleData = await loadCourseHoleDataWithRetry(initialData.courseId);
      }
      
      // Create empty holes with proper par values
      const scorecardHoles = createEmptyHoles(courseHoleData);
      
      // Calculate total par from hole data
      const totalPar = courseHoleData.length > 0 
        ? courseHoleData.reduce((sum, hole) => sum + (hole.par || 4), 0)
        : initialData.coursePar || 72;
      
      // Create a new scorecard with the ScorecardService
      const newScorecard = await ScorecardService.createScorecard(
        {
          courseId: initialData.courseId || 'temp-course',
          courseName: initialData.courseName || 'Temporary Course',
          coursePar: totalPar,
          date: new Date().toISOString().split('T')[0],
          teeBox: initialData.teeBox || {
            name: 'White',
            rating: 72.0,
            slope: 113,
            yardage: 6200,
            color: 'white'
          },
          isPublic: true,
          state: 'live',
          // Use prepared hole data
          holes: scorecardHoles
        },
        user.uid,
        { saveAsDraft: true }
      );
      
      // Only redirect if we successfully created the scorecard with holes
      if (newScorecard && newScorecard.id) {
        console.log('Successfully created scorecard:', newScorecard.id);
        // Reset the creating state before redirecting
        setIsCreatingNewScorecard(false);
        router.replace(`/scorecard/live?id=${newScorecard.id}`);
      } else {
        throw new Error('Failed to create scorecard');
      }
    } catch (error) {
      console.error('Error creating new live scorecard:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to start live scoring. Please try again.'
      });
      setIsCreatingNewScorecard(false);
    }
  }, [scorecardId, initialData, user, router, showNotification, loadCourseHoleDataWithRetry, createEmptyHoles, isCreatingNewScorecard]);

  // Initialize new scorecard when component mounts
  useEffect(() => {
    if (!scorecardId && initialData && user && !isCreatingNewScorecard) {
      createNewScorecard();
    }
  }, [scorecardId, initialData, user, createNewScorecard, isCreatingNewScorecard]);

  // Handle course hole loading errors
  useEffect(() => {
    if (courseHolesError && holeDateLoadAttempts < 3 && initialData?.courseId) {
      console.log('Course holes error, retrying load');
      setHoleDataLoadAttempts(prev => prev + 1);
      setTimeout(() => {
        refreshCourseHoles(); 
      }, 500 * Math.pow(2, holeDateLoadAttempts));
    }
  }, [courseHolesError, holeDateLoadAttempts, initialData?.courseId, refreshCourseHoles]);
  
  // Find the first incomplete hole when loading a scorecard
  useEffect(() => {
    if (currentScorecard && Array.isArray(currentScorecard.holes) && currentScorecard.holes.length > 0) {
      const firstIncompleteHole = currentScorecard.holes.findIndex(hole => hole.score === 0);
      if (firstIncompleteHole !== -1) {
        setCurrentHole(firstIncompleteHole + 1);
      } else {
        // All holes have scores, start at hole 1
        setCurrentHole(1);
      }
    }
  }, [currentScorecard]);

  // Navigate to previous or next hole
  const navigateHole = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentHole > 1) {
      setCurrentHole(currentHole - 1);
    } else if (direction === 'next' && currentHole < 18) {
      setCurrentHole(currentHole + 1);
    }
  };

  // Handle score selection
  const handleScoreSelected = (score: number) => {
    if (!currentScorecard) return;
    
    // Update the score
    updateHoleScore(currentHole, score);
    
    // Auto-advance to next hole if not the last hole
    if (currentHole < 18) {
      // Short delay to let the user see the score change
      setTimeout(() => {
        setCurrentHole(currentHole + 1);
      }, 300);
    }
  };
  
  // Handle completing the round
  const handleFinishRound = async () => {
    if (!currentScorecard) return;
    
    setIsFinishing(true);
    try {
      // Complete the round and share to feed
      await finishRound(true);
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Round Completed',
        description: 'Your round has been completed and saved successfully.'
      });
      
      // Redirect to the scorecard view
      router.push(`/scorecard/${currentScorecard.id}?completed=true`);
    } catch (error) {
      console.error('Error finishing round:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to complete round. Please try again.'
      });
    } finally {
      setIsFinishing(false);
    }
  };

  // Loading state
  if (isLoadingScorecard || isCreatingNewScorecard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <LoadingSpinner size="lg" color="primary" label={isCreatingNewScorecard ? "Setting up live scoring..." : "Loading scorecard..."} />
      </div>
    );
  }

  // Error state
  if (error || !currentScorecard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md mb-4">
          {error?.message || 'Failed to load scorecard'}
        </div>
        <div className="flex space-x-2">
          <Button onClick={retryLoading}>
            Retry Loading
          </Button>
          <Button variant="outline" onClick={() => router.push('/scorecard')}>
            Back to Scorecards
          </Button>
        </div>
      </div>
    );
  }

  // Check if holes array exists and is valid
  if (!currentScorecard.holes || !Array.isArray(currentScorecard.holes) || currentScorecard.holes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-md mb-4">
          Scorecard data is incomplete. Missing holes information.
        </div>
        <div className="flex space-x-2">
          <Button onClick={retryLoading}>
            Retry Loading
          </Button>
          <Button variant="outline" onClick={() => router.push('/scorecard')}>
            Back to Scorecards
          </Button>
        </div>
      </div>
    );
  }

  // Get current hole data from the scorecard
  const currentHoleData = currentScorecard.holes.find(h => h.number === currentHole) || {
    number: currentHole,
    par: 4,
    score: 0,
    fairwayHit: null,
    greenInRegulation: false,
    putts: 0,
    penalties: 0
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      {/* Header with course and score info */}
      <div className="p-4 bg-green-500 text-white">
        <h1 className="text-lg font-bold mb-1">{currentScorecard.courseName}</h1>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm opacity-90">
              {currentScorecard.teeBox?.name || 'Default'} • {currentScorecard.teeBox?.yardage || '6200'} yards
            </span>
          </div>
          <div className="text-xl font-bold">
            {currentScorecard.totalScore > 0
              ? `${currentScorecard.totalScore} (${currentScorecard.scoreToPar > 0 ? '+' : ''}${currentScorecard.scoreToPar})`
              : 'No scores yet'}
          </div>
        </div>
      </div>
      
      {/* Hole navigation */}
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateHole('prev')}
          disabled={currentHole === 1}
        >
          Previous
        </Button>
        
        <div className="text-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Hole</span>
          <div className="text-xl font-bold">{currentHole} / 18</div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateHole('next')}
          disabled={currentHole === 18}
        >
          Next
        </Button>
      </div>
      
      {/* Current hole view */}
      <div className="flex-1 p-4">
        <LiveHoleView
          hole={currentHoleData}
          updateHoleData={(data) => updateHoleData(currentScorecard.id, currentHole, data)}
          isLoading={isSaving}
        />
      </div>
      
      {/* Score input pad */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <ScoreInput
          currentValue={currentHoleData.score}
          par={currentHoleData.par}
          onScoreSelected={handleScoreSelected}
          disabled={isSaving}
        />
      </div>
      
      {/* Footer with stats and finish button */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <LiveStats scorecard={currentScorecard} />
        
        <div className="mt-4 flex justify-center">
          <Button 
            onClick={handleFinishRound}
            disabled={isFinishing || isSaving}
            isLoading={isFinishing}
          >
            Finish Round
          </Button>
        </div>
      </div>
    </div>
  );
}
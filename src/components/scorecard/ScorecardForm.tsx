// src/components/scorecard/ScorecardForm.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useScorecardForm, ScorecardProvider } from '@/lib/contexts/ScoreCardContext';
import { ScorecardService, ScorecardOptions } from '@/lib/services/ScorecardService';
import { CourseService } from '@/lib/services/CourseService';
import { useCourse, useCourseHoles } from '@/lib/hooks/useCourse';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HoleByHole } from './HoleByHole';
import { StatTracker } from './StatTracker';
import { CourseSelector } from './CourseSelector';
import { TeeSelector } from './TeeSelector';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { Scorecard, HoleData, TeeBox as ScorecardTeeBox } from '@/types/scorecard';
import { HoleData as CourseHoleData } from '@/types/course'; 
import { ErrorBoundary } from '@/components/common/feedback/ErrorBoundary';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { cacheService, CacheOperationPriority, CACHE_KEYS, CACHE_TTL } from '@/lib/services/CacheService';

interface ScorecardFormProps {
  scorecardId?: string; // If provided, we're editing an existing scorecard
  initialData?: Partial<Scorecard>;
  isLiveScoring?: boolean;
}

// Create a wrapper component that provides the ScorecardContext
export function ScorecardForm(props: ScorecardFormProps) {
  return (
    <ScorecardProvider initialScorecard={props.initialData as Scorecard}>
      <ErrorBoundary
        fallback={<ScorecardFormError />}
      >
        <ScorecardFormContent {...props} />
      </ErrorBoundary>
    </ScorecardProvider>
  );
}

// Error fallback component
function ScorecardFormError() {
  const router = useRouter();
  
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-300">
      <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
      <p className="mb-4">We encountered an error while loading or processing the scorecard. Please try again.</p>
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
        >
          Reload Page
        </Button>
        
        <Button 
          onClick={() => router.push('/scorecard')}
        >
          Return to Scorecards
        </Button>
      </div>
    </div>
  );
}

// Main component implementation
function ScorecardFormContent({ 
  scorecardId, 
  initialData,
  isLiveScoring = false
}: ScorecardFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  const { 
    scorecard, 
    isLoading: isLoadingScorecard, 
    isSaving, 
    saveScorecard 
  } = useScorecardForm(scorecardId);

  // Form state
  const [courseId, setCourseId] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [coursePar, setCoursePar] = useState<number>(72);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teeBox, setTeeBox] = useState<ScorecardTeeBox>({
    name: 'White',
    rating: 72.0,
    slope: 113,
    yardage: 6200,
    color: 'white' // Fixed the missing required color property
  });
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [holes, setHoles] = useState<HoleData[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'details' | 'holes' | 'stats'>('details');
  
  // Use our course hooks to load course data
  const { holes: courseHoles, isLoading: isLoadingHoles } = useCourseHoles(courseId);
  
  // States for handicap
  const [handicapIndex, setHandicapIndex] = useState<number | null>(null);
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);
  const [isLoadingHandicap, setIsLoadingHandicap] = useState<boolean>(false);
  
  // Track if we're loading course data
  const [isLoadingCourseData, setIsLoadingCourseData] = useState<boolean>(false);

  // Initialize form with scorecard data
  useEffect(() => {
    if (scorecard) {
      setCourseId(scorecard.courseId);
      setCourseName(scorecard.courseName);
      setCoursePar(scorecard.coursePar);
      setDate(scorecard.date);
      setTeeBox(scorecard.teeBox);
      setIsPublic(scorecard.isPublic);
      setNotes(scorecard.notes || '');
      setHoles(scorecard.holes);
      setCourseHandicap(scorecard.courseHandicap || null);
    } else if (initialData) {
      // Initialize with provided data
      if (initialData.courseId) setCourseId(initialData.courseId);
      if (initialData.courseName) setCourseName(initialData.courseName);
      if (initialData.coursePar) setCoursePar(initialData.coursePar);
      if (initialData.date) setDate(initialData.date);
      if (initialData.teeBox) setTeeBox(initialData.teeBox);
      if (initialData.isPublic !== undefined) setIsPublic(initialData.isPublic);
      if (initialData.notes) setNotes(initialData.notes);
      if (initialData.holes && initialData.holes.length > 0) {
        setHoles(initialData.holes);
      } else {
        // If no holes provided, initialize empty ones
        initializeEmptyHoles(initialData.coursePar || 72);
      }
      
      // Set saved course handicap if available
      if (initialData.courseHandicap !== undefined) {
        setCourseHandicap(initialData.courseHandicap);
      }
    } else if (!isLoadingScorecard) {
      // Initialize 18 empty holes for a new scorecard
      initializeEmptyHoles(72);
    }
  }, [scorecard, initialData, isLoadingScorecard]);

  // FIXED: When course holes load, update the scorecard holes if they're empty or unplayed
  useEffect(() => {
    if (courseHoles && courseHoles.length > 0) {
      // Check if holes are empty or unplayed inside the effect 
      const hasNoScores = !holes.length || holes.every(h => h.score === 0);
      
      if (hasNoScores) {
        const loadCourseHoles = async () => {
          try {
            setIsLoadingCourseData(true);
            
            // Convert course holes to scorecard holes
            const scorecardHoles = CourseService.courseHolesToScorecardHoles(courseHoles);
            setHoles(scorecardHoles);
            
            // Update course par if needed
            const totalPar = courseHoles.reduce((sum, hole) => sum + hole.par, 0);
            if (totalPar !== coursePar) {
              setCoursePar(totalPar);
            }
          } catch (error) {
            console.error('Error converting course holes:', error);
          } finally {
            setIsLoadingCourseData(false);
          }
        };
        
        loadCourseHoles();
      }
    }
  }, [courseHoles, coursePar]); // Removed holes from dependency array

  // Load user's handicap index
  useEffect(() => {
    const loadUserHandicapIndex = async () => {
      if (!user) return;
      
      setIsLoadingHandicap(true);
      try {
        if (user.handicapIndex !== undefined) {
          setHandicapIndex(user.handicapIndex);
          
          // If we already have a course and tee box selected, calculate course handicap
          if (teeBox && coursePar && courseId) {
            const handicap = await ScorecardService.getCourseHandicap(
              user.uid,
              courseId,
              teeBox
            );
            setCourseHandicap(handicap);
          }
        }
      } catch (error) {
        console.error("Error loading user handicap:", error);
      } finally {
        setIsLoadingHandicap(false);
      }
    };
    
    loadUserHandicapIndex();
  }, [user, teeBox, coursePar, courseId]);

  // Initialize empty holes when starting a new scorecard
  const initializeEmptyHoles = (par: number) => {
    const defaultPar = Math.floor(par / 18);
    const holesData: HoleData[] = [];
    
    for (let i = 1; i <= 18; i++) {
      holesData.push({
        number: i,
        par: defaultPar,
        score: 0,
        fairwayHit: null,
        greenInRegulation: false,
        putts: 0,
        penalties: 0
      });
    }
    
    setHoles(holesData);
  };

  // Load course hole data
  const loadCourseHoleData = useCallback(async (courseId: string) => {
    if (!courseId) return null;
    
    setIsLoadingCourseData(true);
    
    try {
      // Try to get from cache first with CRITICAL priority
      const cacheKey = CACHE_KEYS.COURSE_HOLES(courseId);
      let holeData: CourseHoleData[] | null = await cacheService.get<CourseHoleData[]>(
        cacheKey,
        CacheOperationPriority.CRITICAL
      );
      
      // If not in cache, fetch from CourseService
      if (!holeData || !Array.isArray(holeData) || holeData.length === 0) {
        console.log('Course holes not in cache, fetching from service');
        holeData = await CourseService.getCourseHoles(courseId);
        
        // Cache the result
        if (holeData && Array.isArray(holeData) && holeData.length > 0) {
          await cacheService.set(
            cacheKey,
            holeData,
            { ttl: CACHE_TTL.COURSE },
            CacheOperationPriority.CRITICAL
          );
        }
      }
      
      // If we got data, convert to scorecard holes
      if (holeData && Array.isArray(holeData) && holeData.length > 0) {
        // Calculate total par
        const totalPar = holeData.reduce((sum, hole) => sum + hole.par, 0);
        if (totalPar !== coursePar) {
          setCoursePar(totalPar);
        }
        
        const scorecardHoles = CourseService.courseHolesToScorecardHoles(holeData);
        setHoles(scorecardHoles);
      }
      
      return holeData;
    } catch (error) {
      console.error('Error loading course hole data:', error);
      showNotification({
        type: 'warning',
        title: 'Course Data Issue',
        description: 'Unable to load hole data for this course. Default values will be used.'
      });
      return null;
    } finally {
      setIsLoadingCourseData(false);
    }
  }, [coursePar, showNotification]);

  // Handle course selection
  const handleCourseSelected = async (course: { id: string; name: string; par: number }) => {
    setCourseId(course.id);
    setCourseName(course.name);
    setCoursePar(course.par);
    
    // Load hole data from the course
    await loadCourseHoleData(course.id);

    // If we have both handicap index and tee box, recalculate course handicap
    if (handicapIndex !== null && teeBox && user) {
      const handicap = await ScorecardService.getCourseHandicap(
        user.uid,
        course.id,
        teeBox
      );
      setCourseHandicap(handicap);
    }
  };

  // Handle tee box selection
  const handleTeeSelected = async (selectedTeeBox: ScorecardTeeBox) => {
    setTeeBox(selectedTeeBox);
    
    // Recalculate course handicap with the new tee box
    if (handicapIndex !== null && user && courseId) {
      const handicap = await ScorecardService.getCourseHandicap(
        user.uid,
        courseId,
        selectedTeeBox
      );
      setCourseHandicap(handicap);
    }
  };

  // Update a specific hole's data
  const updateHoleData = (holeNumber: number, data: Partial<HoleData>) => {
    setHoles(prevHoles => {
      return prevHoles.map(hole => {
        if (hole.number === holeNumber) {
          return { ...hole, ...data };
        }
        return hole;
      });
    });
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    
    if (!user) {
      setFormError('You must be logged in to save a scorecard');
      return;
    }
    
    if (!courseId || !courseName) {
      setFormError('Please select a course');
      return;
    }
    
    try {
      // Check if any holes have scores
      const hasScores = holes.some(hole => hole.score > 0);
      
      if (!hasScores && !scorecardId) {
        if (!confirm('No scores have been entered. Create this scorecard anyway?')) {
          return;
        }
      }
      
      // Calculate stats before saving
      const stats = ScorecardService.calculateStats(holes);
      
      // Prepare scorecard data
      const data: Partial<Scorecard> = {
        courseId,
        courseName,
        coursePar,
        date,
        teeBox,
        holes,
        stats,
        isPublic,
        courseHandicap,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - coursePar,
        ...(notes ? { notes } : {})
      };
      
      // Define save options
      const options: ScorecardOptions = {
        autoShareToFeed: hasScores && isPublic,
        updateHandicap: hasScores,
        calculateStats: true,
        saveAsDraft: !hasScores
      };
      
      // Save the scorecard
      const savedScorecard = await saveScorecard(data, options);
      
      if (savedScorecard) {
        // Show success notification
        showNotification({
          type: 'success',
          title: scorecardId ? 'Scorecard Updated' : 'Scorecard Created',
          description: scorecardId
            ? 'Your scorecard has been updated successfully.'
            : 'Your scorecard has been created successfully.'
        });
        
        // Redirect to the scorecard view page
        router.push(`/scorecard/${savedScorecard.id}${hasScores ? '?completed=true' : ''}`);
      }
    } catch (error) {
      console.error('Error saving scorecard:', error);
      setFormError('Failed to save scorecard. Please try again.');
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to save scorecard. Please try again.'
      });
    }
  };

  // Show loading state
  if (isLoadingScorecard) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" color="primary" label="Loading scorecard..." />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>
            {scorecardId ? 'Edit Scorecard' : isLiveScoring ? 'Live Scoring' : 'Add New Round'}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md mb-4 text-sm">
              {formError}
            </div>
          )}
          
          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              type="button"
              className={`px-4 py-2 font-medium text-sm ${
                currentTab === 'details'
                  ? 'border-b-2 border-green-500 text-green-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setCurrentTab('details')}
            >
              Round Details
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-sm ${
                currentTab === 'holes'
                  ? 'border-b-2 border-green-500 text-green-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setCurrentTab('holes')}
            >
              Hole-by-Hole
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-sm ${
                currentTab === 'stats'
                  ? 'border-b-2 border-green-500 text-green-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setCurrentTab('stats')}
            >
              Statistics
            </button>
          </div>
          
          {/* Round Details Tab */}
          {currentTab === 'details' && (
            <div className="space-y-4">
              {isLoadingCourseData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-blue-700 dark:text-blue-300 flex items-center space-x-2">
                  <LoadingSpinner size="sm" color="primary" />
                  <span>Loading course data...</span>
                </div>
              )}
              
              <CourseSelector
                onCourseSelected={handleCourseSelected}
                initialCourseId={courseId}
                initialCourseName={courseName}
              />
              
              <TeeSelector
                onTeeSelected={handleTeeSelected}
                initialTeeBox={teeBox}
                courseId={courseId}
              />
              
              {/* Handicap Information Section */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                <h3 className="text-sm font-medium mb-2">Handicap Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Handicap Index
                    </div>
                    <div className="flex items-center">
                      {isLoadingHandicap ? (
                        <LoadingSpinner size="sm" color="primary" />
                      ) : (
                        <span className="text-lg font-bold">
                          {handicapIndex !== null ? handicapIndex.toFixed(1) : 'N/A'}
                        </span>
                      )}
                      <span className="ml-2 text-xs text-gray-500">
                        (Your USGA Handicap Index)
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Course Handicap
                    </div>
                    <div className="flex items-center">
                      {(isLoadingHandicap || isLoadingCourseData) ? (
                        <LoadingSpinner size="sm" color="primary" />
                      ) : (
                        <span className="text-lg font-bold">
                          {courseHandicap !== null ? courseHandicap : 'N/A'}
                        </span>
                      )}
                      <span className="ml-2 text-xs text-gray-500">
                        (Strokes for {teeBox.name} tees at {courseName || 'this course'})
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>Your Course Handicap is dynamically calculated using your Handicap Index and this course's specific characteristics (slope, rating, and par).</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  label="Date Played"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Visibility
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
                      Share this round on my profile
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-gray-700 dark:text-gray-100"
                  rows={3}
                  placeholder="Weather conditions, playing partners, memorable shots..."
                />
              </div>
            </div>
          )}
          
          {/* Hole-by-Hole Tab */}
          {currentTab === 'holes' && (
            <HoleByHole
              holes={holes}
              updateHoleData={updateHoleData}
              coursePar={coursePar}
              isLoadingCourseData={isLoadingCourseData}
            />
          )}
          
          {/* Statistics Tab */}
          {currentTab === 'stats' && (
            <StatTracker
              holes={holes}
              updateHoleData={updateHoleData}
              stats={ScorecardService.calculateStats(holes)}
            />
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            Cancel
          </Button>
          
          {/* Navigation buttons based on current tab */}
          {currentTab === 'details' ? (
            <Button
              type="button"
              onClick={() => setCurrentTab('holes')}
            >
              Next: Hole-by-Hole
            </Button>
          ) : currentTab === 'holes' ? (
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentTab('details')}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentTab('stats')}
              >
                Next: Statistics
              </Button>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentTab('holes')}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                isLoading={isSaving}
              >
                Save Scorecard
              </Button>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
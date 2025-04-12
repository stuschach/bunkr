// src/components/scorecard/LiveScoring/LiveScorecard.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { LiveHoleView } from './LiveHoleView';
import { ScoreInput } from './ScoreInput';
import { LiveStats } from './LiveStats';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';
import { Scorecard, HoleData } from '@/types/scorecard';
import { fanoutPostToFeeds } from '@/lib/firebase/feed-service';
import { DenormalizedAuthorData } from '@/types/post';
import { HandicapService } from '@/lib/handicap/handicapService';
import { debugLog } from '@/lib/utils/debug';

interface LiveScorecardProps {
  scorecardId?: string;
  initialData?: Partial<Scorecard>;
}

export function LiveScorecard({ scorecardId, initialData }: LiveScorecardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // State for the current hole
  const [currentHole, setCurrentHole] = useState<number>(1);
  
  // State for the scorecard data
  const [scorecardData, setScorecardData] = useState<Scorecard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCourseData, setIsLoadingCourseData] = useState<boolean>(false);

  // Get courseId and courseName from URL parameters or props
  useEffect(() => {
    if (!user) {
      setError('You must be logged in to use live scoring');
      setIsLoading(false);
      return;
    }

    const loadOrInitializeScorecard = async () => {
      try {
        if (scorecardId) {
          // Load existing scorecard
          const scorecardRef = doc(db, 'scorecards', scorecardId);
          const scorecardSnap = await getDoc(scorecardRef);
          
          if (scorecardSnap.exists()) {
            const data = scorecardSnap.data() as Scorecard;
            setScorecardData({
              id: scorecardId,
              ...data
            });
            
            // Find the first incomplete hole
            const firstIncompleteHole = data.holes.findIndex(hole => hole.score === 0);
            if (firstIncompleteHole !== -1) {
              setCurrentHole(firstIncompleteHole + 1);
            } else {
              // All holes have scores, start at hole 1
              setCurrentHole(1);
            }
          } else {
            setError('Scorecard not found');
          }
        } else if (initialData) {
          // First, load hole data from the course if available
          const holeData = await loadCourseHoleData(initialData.courseId || 'temp-course');
          
          // Create a new scorecard from initial data
          // CHANGE: Use Firestore's auto-generated ID instead of timestamp-based ID
          const scorecardRef = doc(collection(db, 'scorecards'));
          const newScorecardId = scorecardRef.id;
          
          let emptyHoles: HoleData[] = [];
          
          if (holeData && holeData.length === 18) {
            // Use hole data loaded from the course
            emptyHoles = holeData;
            debugLog('Using hole data from course:', emptyHoles);
          } else {
            // Initialize 18 empty holes with default par
            emptyHoles = Array.from({ length: 18 }, (_, i) => ({
              number: i + 1,
              par: 4, // Default par
              score: 0,
              fairwayHit: null,
              greenInRegulation: false,
              putts: 0,
              penalties: 0,
            }));
            debugLog('Using default hole data');
          }
          
          const newScorecard: Scorecard = {
            id: newScorecardId,
            userId: user.uid,
            courseId: initialData.courseId || 'temp-course',
            courseName: initialData.courseName || 'Temporary Course',
            coursePar: initialData.coursePar || 72,
            date: new Date().toISOString().split('T')[0],
            totalScore: 0,
            scoreToPar: 0,
            courseHandicap: null,
            holes: emptyHoles,
            teeBox: initialData.teeBox || {
              name: 'White',
              rating: 72.0,
              slope: 113,
              yardage: 6200
            },
            stats: {
              totalPutts: 0,
              fairwaysHit: 0,
              fairwaysTotal: 0,
              greensInRegulation: 0,
              penalties: 0
            },
            isPublic: true,
            // NEW: Add state field to track live vs completed rounds
            state: 'live'
          };
          
          setScorecardData(newScorecard);
          
          // Save the new scorecard to Firestore
          await setDoc(scorecardRef, {
            ...newScorecard,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          setError('No scorecard data provided');
        }
      } catch (error) {
        console.error('Error loading scorecard:', error);
        setError('Failed to load or create scorecard');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOrInitializeScorecard();
  }, [user, scorecardId, initialData]);

  // Function to load hole data from the course
  const loadCourseHoleData = async (courseId: string): Promise<HoleData[] | null> => {
    if (!courseId || courseId === 'temp-course') return null;
    
    setIsLoadingCourseData(true);
    
    try {
      debugLog(`Loading hole data for course: ${courseId}`);
      
      // Check first if the course exists
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        console.error(`Course with ID ${courseId} does not exist`);
        return null;
      }
      
      const courseData = courseDoc.data();
      debugLog('Course data:', courseData);
      
      // Query for hole data
      const holesRef = collection(db, 'courses', courseId, 'holes');
      const holesSnapshot = await getDocs(query(holesRef));
      
      debugLog(`Found ${holesSnapshot.size} holes for course ${courseId}`);
      
      // Initialize 18 holes with default values
      const holeData: HoleData[] = [];
      for (let i = 1; i <= 18; i++) {
        holeData.push({
          number: i,
          par: 4, // Default par
          score: 0,
          fairwayHit: null,
          greenInRegulation: false,
          putts: 0,
          penalties: 0
        });
      }
      
      if (!holesSnapshot.empty) {
        // Update holes with data from Firestore
        holesSnapshot.docs.forEach(doc => {
          const holeNumber = parseInt(doc.id);
          if (holeNumber >= 1 && holeNumber <= 18) {
            const holeIndex = holeNumber - 1;
            const data = doc.data();
            
            debugLog(`Hole ${holeNumber} data:`, data);
            
            holeData[holeIndex] = {
              ...holeData[holeIndex],
              par: data.par || 4
            };
          }
        });
        
        debugLog('Processed hole data:', holeData);
        return holeData;
      } else {
        debugLog('No hole data found, using defaults');
        
        // Set all pars to match the course total par if available
        if (courseData.par) {
          const totalPar = courseData.par;
          debugLog(`Setting default pars to match course total par: ${totalPar}`);
          
          // Create a standard layout:
          // - 4 par 3s (holes 2, 7, 11, 16)
          // - 4 par 5s (holes 4, 9, 13, 18)
          // - The rest are par 4s
          const par3Holes = [2, 7, 11, 16];
          const par5Holes = [4, 9, 13, 18];
          
          holeData.forEach((hole, index) => {
            const holeNumber = index + 1;
            if (par3Holes.includes(holeNumber)) {
              holeData[index].par = 3;
            } else if (par5Holes.includes(holeNumber)) {
              holeData[index].par = 5;
            } else {
              holeData[index].par = 4;
            }
          });
          
          // Adjust if necessary to match the course par
          let calculatedPar = holeData.reduce((sum, hole) => sum + hole.par, 0);
          const diff = totalPar - calculatedPar;
          
          if (diff !== 0) {
            debugLog(`Adjusting pars to match course total. Difference: ${diff}`);
            
            if (diff > 0) {
              // Need to increase some pars
              for (let i = 0; i < diff && i < holeData.length; i++) {
                // Start with par 4s that aren't already par 5s
                const hole = holeData.find(h => h.par === 4 && !par5Holes.includes(h.number));
                if (hole) {
                  hole.par = 5;
                }
              }
            } else if (diff < 0) {
              // Need to decrease some pars
              for (let i = 0; i < Math.abs(diff) && i < holeData.length; i++) {
                // Start with par 4s that aren't already par 3s
                const hole = holeData.find(h => h.par === 4 && !par3Holes.includes(h.number));
                if (hole) {
                  hole.par = 3;
                }
              }
            }
          }
        }
        
        return holeData;
      }
    } catch (error) {
      console.error('Error loading course hole data:', error);
      return null;
    } finally {
      setIsLoadingCourseData(false);
    }
  };

  // Update a hole's data
  const updateHoleData = async (holeNumber: number, data: Partial<HoleData>) => {
    if (!scorecardData) return;
    
    try {
      setIsSaving(true);
      
      // Update local state
      const updatedHoles = scorecardData.holes.map(hole => {
        if (hole.number === holeNumber) {
          return { ...hole, ...data };
        }
        return hole;
      });
      
      // Calculate new statistics
      const stats = calculateStats(updatedHoles);
      
      // Update scorecard data
      const updatedScorecard = {
        ...scorecardData,
        holes: updatedHoles,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - scorecardData.coursePar,
        stats: {
          totalPutts: stats.totalPutts,
          fairwaysHit: stats.fairwaysHit,
          fairwaysTotal: stats.fairwaysTotal,
          greensInRegulation: stats.greensInRegulation,
          penalties: stats.penalties,
          eagles: stats.eagles,
          birdies: stats.birdies,
          pars: stats.pars,
          bogeys: stats.bogeys,
          doubleBogeys: stats.doubleBogeys,
          worseThanDouble: stats.worseThanDouble
        }
      };
      
      setScorecardData(updatedScorecard);
      
      // Save to Firestore
      await updateDoc(doc(db, 'scorecards', scorecardData.id), {
        holes: updatedHoles,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - scorecardData.coursePar,
        stats: updatedScorecard.stats,
        updatedAt: serverTimestamp()
      });
      
      // Auto-advance to next hole if score is entered
      if (data.score && data.score > 0 && currentHole < 18) {
        setCurrentHole(currentHole + 1);
      }
    } catch (error) {
      console.error('Error updating hole data:', error);
      showNotification({
        type: 'error',
        title: 'Save Error',
        description: 'Failed to save your score. Please check your connection.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate to previous or next hole
  const navigateHole = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentHole > 1) {
      setCurrentHole(currentHole - 1);
    } else if (direction === 'next' && currentHole < 18) {
      setCurrentHole(currentHole + 1);
    }
  };

  // Finish the round and post to feed
  const finishRound = async () => {
    if (!scorecardData || !user) return;
    
    try {
      setIsFinishing(true);
      
      // Create post content with proper formatting for the score relative to par
      let scoreToParText = '';
      const scoreToPar = scorecardData.scoreToPar || 0; // Default to 0 if undefined
      
      if (scoreToPar === 0) {
        scoreToParText = 'even par';
      } else if (scoreToPar > 0) {
        scoreToParText = `+${scoreToPar}`;
      } else {
        scoreToParText = `${scoreToPar}`;
      }
      
      const postContent = `Just finished a round at ${scorecardData.courseName} with a score of ${scorecardData.totalScore} (${scoreToParText})!`;
      
      // Make sure we have a valid ID
      const id = scorecardData.id;
      
      // Format the scorecard data for posting to feed
      const postData = {
        authorId: user.uid,
        content: postContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        postType: 'round',
        roundId: id,
        
        // Include scorecard data to display in the feed
        courseName: scorecardData.courseName,
        coursePar: scorecardData.coursePar,
        totalScore: scorecardData.totalScore,
        scoreToPar: scorecardData.scoreToPar,
        holes: scorecardData.holes,
        teeBox: scorecardData.teeBox,
        stats: scorecardData.stats,
        // CHANGE HERE: Ensure date is in proper format
        date: typeof scorecardData.date === 'string' ? scorecardData.date : new Date().toISOString().split('T')[0],
        
        location: {
          name: scorecardData.courseName,
          id: scorecardData.courseId
        },
        visibility: scorecardData.isPublic ? 'public' : 'private',
        likes: 0,
        comments: 0,
        likedBy: [],
        hashtags: ['golf', 'scorecard'],
        media: []
      };
      
      // Add to the posts collection
      const postRef = await addDoc(collection(db, 'posts'), postData);
      
      // Create denormalized author data for the fanout
      const authorData: DenormalizedAuthorData = {
        uid: user.uid,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        handicapIndex: user.handicapIndex !== undefined ? user.handicapIndex : null
      };
      
      // Fan out the post to followers' feeds
      await fanoutPostToFeeds(postRef.id, user.uid, authorData, 'round');
      
      // Make sure the scorecard document has all necessary fields
      await updateDoc(doc(db, 'scorecards', id), {
        userId: user.uid,
        courseId: scorecardData.courseId,
        courseName: scorecardData.courseName,
        coursePar: scorecardData.coursePar,
        date: typeof scorecardData.date === 'string' ? scorecardData.date : new Date().toISOString().split('T')[0],
        totalScore: scorecardData.totalScore,
        scoreToPar: scorecardData.scoreToPar,
        courseHandicap: scorecardData.courseHandicap,
        teeBox: scorecardData.teeBox,
        stats: scorecardData.stats,
        isPublic: scorecardData.isPublic,
        finalizedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isCompleted: true,
        // NEW: Update state to completed
        state: 'completed'
      });
      
      debugLog('Round document fully updated with final stats');
      
      // ADD THIS CODE: Update the user's handicap
      try {
        debugLog('Updating handicap after round completion:', id);
        await HandicapService.updateHandicapAfterRound(user.uid, id);
      } catch (handicapError) {
        console.error('Error updating handicap:', handicapError);
        showNotification({
          type: 'warning',
          title: 'Handicap Update Issue',
          description: 'Your scorecard was saved but your handicap could not be updated.'
        });
      }
      
      showNotification({
        type: 'success',
        title: 'Round Completed',
        description: 'Your round has been posted to your feed!'
      });
      
      debugLog('Round posted to feed successfully');
      
      // Navigate to the scorecard view
      router.push(`/scorecard/${id}?completed=true`);
    } catch (error) {
      console.error('Error posting round to feed:', error);
      showNotification({
        type: 'warning',
        title: 'Partial Success',
        description: 'Your round was saved but could not be posted to your feed.'
      });
      
      // Still navigate to the scorecard view even if posting fails
      router.push(`/scorecard/${scorecardData.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  // Calculate stats based on hole data
  const calculateStats = (holes: HoleData[]) => {
    let totalScore = 0;
    let totalPutts = 0;
    let fairwaysHit = 0;
    let fairwaysTotal = 0;
    let greensInRegulation = 0;
    let penalties = 0;
    let eagles = 0;
    let birdies = 0;
    let pars = 0;
    let bogeys = 0;
    let doubleBogeys = 0;
    let worseThanDouble = 0;

    holes.forEach(hole => {
      // Only count holes with scores
      if (hole.score > 0) {
        totalScore += hole.score;
        totalPutts += hole.putts || 0;
        penalties += hole.penalties || 0;
        
        // Fairway hit (excludes par 3s)
        if (hole.par > 3) {
          fairwaysTotal++;
          if (hole.fairwayHit === true) fairwaysHit++;
        }
        
        // Green in regulation
        if (hole.greenInRegulation) greensInRegulation++;
        
        // Score classification
        const scoreToPar = hole.score - hole.par;
        if (scoreToPar <= -2) eagles++;
        else if (scoreToPar === -1) birdies++;
        else if (scoreToPar === 0) pars++;
        else if (scoreToPar === 1) bogeys++;
        else if (scoreToPar === 2) doubleBogeys++;
        else if (scoreToPar > 2) worseThanDouble++;
      }
    });

    return {
      totalScore,
      totalPutts,
      fairwaysHit,
      fairwaysTotal,
      greensInRegulation,
      penalties,
      eagles,
      birdies,
      pars,
      bogeys,
      doubleBogeys,
      worseThanDouble
    };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <LoadingSpinner size="lg" color="primary" label="Loading scorecard..." />
      </div>
    );
  }

  if (error || !scorecardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md mb-4">
          {error || 'Failed to load scorecard'}
        </div>
        <Button onClick={() => router.push('/scorecard')}>
          Back to Scorecards
        </Button>
      </div>
    );
  }

  const currentHoleData = scorecardData.holes.find(h => h.number === currentHole) || {
    number: currentHole,
    par: 4,
    score: 0,
    fairwayHit: null,
    greenInRegulation: false,
    putts: 0
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      {/* Header with course and score info */}
      <div className="p-4 bg-green-500 text-white">
        <h1 className="text-lg font-bold mb-1">{scorecardData.courseName}</h1>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm opacity-90">
              {scorecardData.teeBox.name} • {scorecardData.teeBox.yardage} yards
            </span>
          </div>
          <div className="text-xl font-bold">
            {formatScoreWithRelationToPar(scorecardData.totalScore, scorecardData.coursePar)}
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
          updateHoleData={(data) => updateHoleData(currentHole, data)}
          isLoading={isSaving}
        />
      </div>
      
      {/* Score input pad */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <ScoreInput
          currentValue={currentHoleData.score}
          par={currentHoleData.par}
          onScoreSelected={(score) => updateHoleData(currentHole, { score })}
          disabled={isSaving}
        />
      </div>
      
      {/* Footer with stats and finish button */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <LiveStats scorecard={scorecardData} />
        
        <div className="mt-4 flex justify-center">
          <Button 
            onClick={finishRound}
            disabled={isFinishing}
            isLoading={isFinishing}
          >
            {isFinishing ? 'Finishing...' : 'Finish Round'}
          </Button>
        </div>
      </div>
    </div>
  );
}
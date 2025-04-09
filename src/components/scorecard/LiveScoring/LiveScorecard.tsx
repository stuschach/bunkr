// src/components/scorecard/LiveScoring/LiveScorecard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  const [error, setError] = useState<string | null>(null);

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
          // Create a new scorecard from initial data
          const newScorecardId = `live-${Date.now()}`;
          const emptyHoles: HoleData[] = [];
          
          // Initialize 18 empty holes
          for (let i = 1; i <= 18; i++) {
            emptyHoles.push({
              number: i,
              par: 4, // Default par
              score: 0,
              fairwayHit: null,
              greenInRegulation: false,
              putts: 0,
              penalties: 0,
            });
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
            isPublic: true
          };
          
          setScorecardData(newScorecard);
          
          // Save the new scorecard to Firestore
          await setDoc(doc(db, 'scorecards', newScorecardId), {
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

  // Finish the round
  const finishRound = () => {
    router.push(`/scorecard/${scorecardData?.id}`);
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
          if (hole.fairwayHit) fairwaysHit++;
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
          <Button onClick={finishRound}>
            Finish Round
          </Button>
        </div>
      </div>
    </div>
  );
}
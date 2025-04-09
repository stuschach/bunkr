// src/components/scorecard/ScorecardForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { HoleByHole } from './HoleByHole';
import { StatTracker } from './StatTracker';
import { CourseSelector } from './CourseSelector';
import { TeeSelector } from './TeeSelector';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { HandicapService } from '@/lib/handicap/handicapService';
import { Scorecard, HoleData, TeeBox } from '@/types/scorecard';

interface ScorecardFormProps {
  scorecardId?: string; // If provided, we're editing an existing scorecard
  initialData?: Partial<Scorecard>;
  isLiveScoring?: boolean;
}

export function ScorecardForm({ 
  scorecardId, 
  initialData,
  isLiveScoring = false
}: ScorecardFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Form state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [courseId, setCourseId] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [coursePar, setCoursePar] = useState<number>(72);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teeBox, setTeeBox] = useState<TeeBox>({
    name: 'White',
    rating: 72.0,
    slope: 113,
    yardage: 6200
  });
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [holes, setHoles] = useState<HoleData[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'details' | 'holes' | 'stats'>('details');

  // Load existing scorecard data if editing
  useEffect(() => {
    if (scorecardId) {
      const loadScorecard = async () => {
        setIsLoading(true);
        
        try {
          const scorecardRef = doc(db, 'scorecards', scorecardId);
          const scorecardSnap = await getDoc(scorecardRef);
          
          if (scorecardSnap.exists()) {
            const data = scorecardSnap.data() as Scorecard;
            setCourseId(data.courseId);
            setCourseName(data.courseName);
            setCoursePar(data.coursePar);
            setDate(data.date);
            setTeeBox(data.teeBox);
            setIsPublic(data.isPublic);
            setNotes(data.notes || '');
            setHoles(data.holes);
          } else {
            setFormError('Scorecard not found');
          }
        } catch (error) {
          console.error('Error loading scorecard:', error);
          setFormError('Failed to load scorecard data');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadScorecard();
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
        // Initialize 18 empty holes
        initializeEmptyHoles(initialData.coursePar || 72);
      }
    } else {
      // Initialize 18 empty holes for a new scorecard
      initializeEmptyHoles(72);
    }
  }, [scorecardId, initialData]);

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

  // Handle course selection
  const handleCourseSelected = (course: { id: string; name: string; par: number }) => {
    setCourseId(course.id);
    setCourseName(course.name);
    setCoursePar(course.par);
  };

  // Handle tee box selection
  const handleTeeSelected = (selectedTeeBox: TeeBox) => {
    setTeeBox(selectedTeeBox);
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

  // Calculate stats based on hole data
  const calculateStats = () => {
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

  // Submit the scorecard
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Authentication required',
        description: 'You must be logged in to save a scorecard'
      });
      return;
    }
    
    if (!courseId || !courseName) {
      setFormError('Please select a course');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const stats = calculateStats();
      
      // Create the base scorecard data
      const scorecardData: any = {
        userId: user.uid,
        courseId,
        courseName,
        coursePar,
        date,
        totalScore: stats.totalScore,
        scoreToPar: stats.totalScore - coursePar,
        courseHandicap: null, // This will be calculated using the handicap system
        holes,
        teeBox,
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
        },
        isPublic
      };
      
      // Only add notes if it's not an empty string
      if (notes.trim() !== '') {
        scorecardData.notes = notes;
      }
      
      let newScorecardId = scorecardId;
      
      if (scorecardId) {
        // Update existing scorecard
        const scorecardRef = doc(db, 'scorecards', scorecardId);
        await updateDoc(scorecardRef, {
          ...scorecardData,
          updatedAt: serverTimestamp()
        });
        
        showNotification({
          type: 'success',
          title: 'Scorecard updated',
          description: 'Your scorecard has been updated successfully'
        });
      } else {
        // Create new scorecard
        const newScorecardRef = doc(collection(db, 'scorecards'));
        newScorecardId = newScorecardRef.id;
        await setDoc(newScorecardRef, {
          ...scorecardData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        showNotification({
          type: 'success',
          title: 'Scorecard saved',
          description: 'Your scorecard has been saved successfully'
        });
      }
      
      // Update the user's handicap
      try {
        await HandicapService.updateHandicapAfterRound(user.uid, newScorecardId!);
      } catch (handicapError) {
        console.error('Error updating handicap:', handicapError);
        // Don't fail the whole operation if handicap update fails
      }
      
      // Redirect to scorecard view
      router.push(scorecardId ? `/scorecard/${scorecardId}` : '/scorecard');
      
    } catch (error) {
      console.error('Error saving scorecard:', error);
      setFormError('Failed to save scorecard. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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
              <CourseSelector
                onCourseSelected={handleCourseSelected}
                initialCourseId={courseId}
                initialCourseName={courseName}
              />
              
              <TeeSelector
                onTeeSelected={handleTeeSelected}
                initialTeeBox={teeBox}
              />
              
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
            />
          )}
          
          {/* Statistics Tab */}
          {currentTab === 'stats' && (
            <StatTracker
              holes={holes}
              updateHoleData={updateHoleData}
              stats={calculateStats()}
            />
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
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
                type="submit"
                isLoading={isSubmitting}
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
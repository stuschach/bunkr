// src/components/scorecard/ScorecardForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
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
import { calculateCourseHandicap } from '@/lib/handicap/calculator';
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
  const [isLoadingCourseData, setIsLoadingCourseData] = useState<boolean>(false);
  
  // NEW: States for handicap
  const [handicapIndex, setHandicapIndex] = useState<number | null>(null);
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);
  const [isLoadingHandicap, setIsLoadingHandicap] = useState<boolean>(false);

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
            // Set saved course handicap if available
            if (data.courseHandicap !== undefined) {
              setCourseHandicap(data.courseHandicap);
            }
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
      // Set saved course handicap if available
      if (initialData.courseHandicap !== undefined) {
        setCourseHandicap(initialData.courseHandicap);
      }
    } else {
      // Initialize 18 empty holes for a new scorecard
      initializeEmptyHoles(72);
    }
  }, [scorecardId, initialData]);

  // NEW: Load user's handicap index
  useEffect(() => {
    const loadUserHandicapIndex = async () => {
      if (!user) return;
      
      setIsLoadingHandicap(true);
      try {
        // Fetch user's handicap index from their profile
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.handicapIndex !== undefined) {
            setHandicapIndex(userData.handicapIndex);
            
            // If we already have a course and tee box selected, calculate course handicap
            if (teeBox && coursePar) {
              calculateAndSetCourseHandicap(userData.handicapIndex, teeBox, coursePar);
            }
          }
        } else {
          console.log("User document not found");
        }
      } catch (error) {
        console.error("Error loading user handicap:", error);
      } finally {
        setIsLoadingHandicap(false);
      }
    };
    
    loadUserHandicapIndex();
  }, [user]);

  // NEW: Function to calculate course handicap
  const calculateAndSetCourseHandicap = (
    index: number | null, 
    selectedTeeBox: TeeBox, 
    selectedCoursePar: number
  ) => {
    if (index === null) {
      setCourseHandicap(null);
      return;
    }
    
    // Use the formula: Handicap Index × (Slope Rating ÷ 113) + (Course Rating - Par)
    const calculatedHandicap = calculateCourseHandicap(
      index,
      selectedTeeBox.slope,
      selectedTeeBox.rating,
      selectedCoursePar
    );
    
    setCourseHandicap(calculatedHandicap);
  };

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

  // Load course hole data with improved error handling and logging
  const loadCourseHoleData = async (courseId: string) => {
    if (!courseId) return null;
    
    setIsLoadingCourseData(true);
    
    try {
      console.log(`Loading hole data for course: ${courseId}`);
      
      // Check first if the course exists and is complete
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        console.error(`Course with ID ${courseId} does not exist`);
        showNotification({
          type: 'error',
          title: 'Course Not Found',
          description: 'The selected course could not be found'
        });
        return null;
      }
      
      const courseData = courseDoc.data();
      console.log('Course data:', courseData);
      
      // Query for hole data
      const holesRef = collection(db, 'courses', courseId, 'holes');
      const holesSnapshot = await getDocs(holesRef);
      
      console.log(`Found ${holesSnapshot.size} holes for course ${courseId}`);
      
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
            
            console.log(`Hole ${holeNumber} data:`, data);
            
            holeData[holeIndex] = {
              ...holeData[holeIndex],
              par: data.par || 4
            };
          }
        });
        
        console.log('Processed hole data:', holeData);
        return holeData;
      } else {
        console.log('No hole data found, using defaults');
        
        // If the course is marked as complete but has no hole data, show a warning
        if (courseData.isComplete) {
          showNotification({
            type: 'warning',
            title: 'Missing Hole Data',
            description: 'This course is marked as complete but has no hole data'
          });
        }
        
        // Set all pars to match the course total par if available
        if (courseData.par) {
          const totalPar = courseData.par;
          console.log(`Setting default pars to match course total par: ${totalPar}`);
          
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
            console.log(`Adjusting pars to match course total. Difference: ${diff}`);
            
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
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to load course hole data'
      });
      return null;
    } finally {
      setIsLoadingCourseData(false);
    }
  };

  // Enhanced handleCourseSelected function
  const handleCourseSelected = async (course: { id: string; name: string; par: number }) => {
    console.log('Course selected:', course);
    setCourseId(course.id);
    setCourseName(course.name);
    setCoursePar(course.par);
    
    // Load hole data from the course if available
    const holeData = await loadCourseHoleData(course.id);
    if (holeData) {
      console.log('Setting holes from course data');
      setHoles(holeData);
    } else {
      // Initialize with default pars
      console.log('Initializing empty holes with par:', course.par);
      initializeEmptyHoles(course.par);
    }

    // If we have both handicap index and tee box, recalculate course handicap
    if (handicapIndex !== null && teeBox) {
      calculateAndSetCourseHandicap(handicapIndex, teeBox, course.par);
    }
  };

  // Handle tee box selection
  const handleTeeSelected = (selectedTeeBox: TeeBox) => {
    setTeeBox(selectedTeeBox);
    
    // Recalculate course handicap with the new tee box
    if (handicapIndex !== null) {
      calculateAndSetCourseHandicap(handicapIndex, selectedTeeBox, coursePar);
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

  // Submit the scorecard - FIXED to accept MouseEvent
  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
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
        courseHandicap: courseHandicap, // Save the calculated course handicap
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
      
      // Add net score if handicap available
      if (courseHandicap !== null) {
        scorecardData.netScore = Math.max(stats.totalScore - courseHandicap, 0);
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
        
        // Show notification to user about handicap update failure
        showNotification({
          type: 'warning',
          title: 'Handicap Update Issue',
          description: 'Your scorecard was saved but your handicap could not be updated. This will be fixed automatically later.'
        });
      }
      
      // Auto-post to feed
      try {
        // Format the scorecard data for posting to feed
        const postData = {
          authorId: user.uid,
          content: `Just finished a round at ${courseName} with a score of ${stats.totalScore} (${stats.totalScore - coursePar > 0 ? '+' : ''}${stats.totalScore - coursePar})!`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          postType: 'round',
          roundId: newScorecardId,
          location: {
            name: courseName,
            id: courseId
          },
          visibility: isPublic ? 'public' : 'private',
          likes: 0,
          comments: 0,
          likedBy: [],
          hashtags: ['golf', 'scorecard'],
          media: []
        };
        
        // Add to the posts collection
        await addDoc(collection(db, 'posts'), postData);
        
        console.log('Round automatically posted to feed');
      } catch (postError) {
        console.error('Error posting round to feed:', postError);
        // Don't stop the process if feed posting fails
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
              
              {/* NEW: Handicap Information Section */}
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
          
          {/* Navigation buttons based on current tab - FIXED button types */}
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
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Scorecard'}
              </Button>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
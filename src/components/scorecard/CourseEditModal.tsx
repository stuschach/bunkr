// src/components/scorecard/CourseEditModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeBoxForm } from './TeeBoxForm';
import { HoleDataForm } from './HoleDataForm';
import { formatLocationString, parseLocationString } from '@/lib/utils/location-formatter';

interface CourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string | null;
  initialCourse: any | null;
  onComplete: (courseId: string, data: { par: number, name: string, location?: string }) => void;
}

type TeeBox = {
  id?: string;
  name: string;
  color: string;
  rating: number;
  slope: number;
  yardage: number;
};

type HoleData = {
  number: number;
  par: number;
  distance: number;
  handicapIndex: number;
};

export function CourseEditModal({
  isOpen,
  onClose,
  courseId,
  initialCourse,
  onComplete
}: CourseEditModalProps) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [step, setStep] = useState<'basic' | 'teeBoxes' | 'holeData' | 'review'>('basic');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  
  // Basic course info
  const [courseName, setCourseName] = useState<string>('');
  const [courseLocation, setCourseLocation] = useState<string>('');
  
  // State for tee boxes
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([
    // Default white tees
    {
      name: 'White',
      color: 'white',
      rating: 72.0,
      slope: 113,
      yardage: 6200
    }
  ]);
  
  // State for hole data (initialize with defaults)
  const [holeData, setHoleData] = useState<HoleData[]>(
    Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: 4, // Default par 4
      distance: 350, // Default distance
      handicapIndex: i + 1 // Default handicap index
    }))
  );
  
  // Load course data when the modal opens
  useEffect(() => {
    if (isOpen && courseId) {
      loadCourseData();
    } else {
      // Initialize with data from initialCourse if available
      if (initialCourse) {
        setCourseName(initialCourse.name || '');
        setCourseLocation(initialCourse.location || '');
      }
    }
  }, [isOpen, courseId, initialCourse]);
  
  // Load course data from Firestore
  const loadCourseData = async () => {
    if (!courseId) return;
    
    setIsFetching(true);
    
    try {
      console.log('Loading course data for ID:', courseId);
      
      // Get course document
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        console.log('Found course data:', courseData);
        
        setCourseName(courseData.name || '');
        setCourseLocation(courseData.location?.formattedLocation || '');
        
        // Load tee boxes
        const teeBoxesRef = collection(db, 'courses', courseId, 'teeBoxes');
        const teeBoxesSnapshot = await getDocs(query(teeBoxesRef));
        
        if (!teeBoxesSnapshot.empty) {
          console.log(`Found ${teeBoxesSnapshot.size} tee boxes`);
          
          const loadedTeeBoxes = teeBoxesSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`Tee box ${doc.id}:`, data);
            
            return {
              id: doc.id,
              name: data.name,
              color: data.color,
              rating: data.rating,
              slope: data.slope,
              yardage: data.yardage
            };
          });
          
          setTeeBoxes(loadedTeeBoxes);
        } else {
          console.log('No tee boxes found for this course');
        }
        
        // Load hole data
        const holesRef = collection(db, 'courses', courseId, 'holes');
        const holesSnapshot = await getDocs(query(holesRef));
        
        if (!holesSnapshot.empty) {
          console.log(`Found ${holesSnapshot.size} holes`);
          
          // Initialize with defaults first
          const initialHoleData = Array.from({ length: 18 }, (_, i) => ({
            number: i + 1,
            par: 4,
            distance: 350,
            handicapIndex: i + 1
          }));
          
          // Update with actual hole data
          holesSnapshot.docs.forEach(doc => {
            const holeNumber = parseInt(doc.id);
            if (holeNumber >= 1 && holeNumber <= 18) {
              const holeIndex = holeNumber - 1;
              const data = doc.data();
              console.log(`Hole ${holeNumber} data:`, data);
              
              initialHoleData[holeIndex] = {
                ...initialHoleData[holeIndex],
                par: data.par || 4,
                distance: data.distance || 350,
                handicapIndex: data.handicapIndex || holeIndex + 1
              };
            }
          });
          
          setHoleData(initialHoleData);
        } else {
          console.log('No hole data found for this course');
        }
      } else {
        console.error(`Course with ID ${courseId} not found`);
        showNotification({
          type: 'error',
          title: 'Course Not Found',
          description: 'The requested course could not be found'
        });
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to load course data. Please try again.'
      });
    } finally {
      setIsFetching(false);
    }
  };
  
  // Calculate total par
  const totalPar = holeData.reduce((sum, hole) => sum + hole.par, 0);
  
  // Update tee boxes
  const handleTeeBoxesUpdate = (updatedTeeBoxes: TeeBox[]) => {
    setTeeBoxes(updatedTeeBoxes);
  };
  
  // Update hole data
  const handleHoleDataUpdate = (updatedHoleData: HoleData[]) => {
    setHoleData(updatedHoleData);
  };
  
  // Format location input
  const formatLocation = () => {
    if (!courseLocation.trim()) return '';
    return formatLocationString(courseLocation);
  };
  
  // Navigate to next step
  const handleNextStep = () => {
    if (step === 'basic') {
      setStep('teeBoxes');
    } else if (step === 'teeBoxes') {
      setStep('holeData');
    } else if (step === 'holeData') {
      setStep('review');
    }
  };
  
  // Navigate to previous step
  const handlePrevStep = () => {
    if (step === 'teeBoxes') {
      setStep('basic');
    } else if (step === 'holeData') {
      setStep('teeBoxes');
    } else if (step === 'review') {
      setStep('holeData');
    }
  };
  
  // Save the course update
  const handleSaveCourse = async () => {
    if (!courseId || !user) return;
    
    setIsLoading(true);
    
    try {
      console.log('Saving course updates for ID:', courseId);
      console.log('Updated tee boxes:', teeBoxes);
      console.log('Updated hole data:', holeData);
      
      // Format location
      const formattedLocation = formatLocation();
      const { city, state } = parseLocationString(formattedLocation);
      
      // Use a batch for atomic updates
      const batch = writeBatch(db);
      
      // Update the course document
      const courseRef = doc(db, 'courses', courseId);
      batch.update(courseRef, {
        name: courseName,
        nameTokens: generateSearchTokens(courseName),
        par: totalPar,
        isComplete: true,
        updatedAt: serverTimestamp(),
        location: formattedLocation ? {
          city,
          state,
          formattedLocation
        } : null
      });
      
      // Handle tee boxes
      const teeBoxesRef = collection(db, 'courses', courseId, 'teeBoxes');
      
      // First delete all existing tee boxes
      const existingTeeBoxes = await getDocs(teeBoxesRef);
      console.log(`Deleting ${existingTeeBoxes.size} existing tee boxes`);
      
      existingTeeBoxes.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Then create new tee boxes
      for (const teeBox of teeBoxes) {
        const newTeeBoxRef = doc(teeBoxesRef);
        console.log(`Creating tee box: ${teeBox.name}`);
        
        batch.set(newTeeBoxRef, {
          name: teeBox.name,
          color: teeBox.color,
          rating: teeBox.rating,
          slope: teeBox.slope,
          yardage: teeBox.yardage,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Handle hole data
      const holesRef = collection(db, 'courses', courseId, 'holes');
      
      // First delete all existing holes
      const existingHoles = await getDocs(holesRef);
      console.log(`Deleting ${existingHoles.size} existing holes`);
      
      existingHoles.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Then create new holes
      for (const hole of holeData) {
        const holeRef = doc(holesRef, hole.number.toString());
        console.log(`Creating hole ${hole.number} with par ${hole.par}`);
        
        batch.set(holeRef, {
          number: hole.number,
          par: hole.par,
          distance: hole.distance || 0,
          handicapIndex: hole.handicapIndex || hole.number,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Commit all changes at once
      await batch.commit();
      console.log('Successfully saved all course updates');
      
      // Notify parent of completion
      onComplete(courseId, { 
        par: totalPar, 
        name: courseName,
        location: formattedLocation
      });
      
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Course Updated',
        description: 'Your course has been updated successfully'
      });
    } catch (error) {
      console.error('Error updating course:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to update course. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate search tokens for the course name
  const generateSearchTokens = (name: string): string[] => {
    const tokens = name.toLowerCase().split(/\s+/);
    const result: string[] = [];
    
    // Add individual words
    tokens.forEach(token => {
      if (token.length > 0) {
        result.push(token);
      }
    });
    
    // Add prefixes for partial matching
    tokens.forEach(token => {
      for (let i = 1; i < token.length; i++) {
        result.push(token.substring(0, i));
      }
    });
    
    return [...new Set(result)]; // Remove duplicates
  };
  
  return (
    <Dialog open={isOpen && !!courseId} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {step === 'basic' && 'Edit Course Details'}
          {step === 'teeBoxes' && 'Edit Tee Boxes'}
          {step === 'holeData' && 'Edit Hole Data'}
          {step === 'review' && 'Review Course Updates'}
        </DialogTitle>
      </DialogHeader>
      <DialogContent className="max-w-2xl">
        {isFetching ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner size="md" color="primary" label="Loading course data..." />
          </div>
        ) : courseId ? (
          <>
            {/* Step indicator */}
            <div className="flex justify-between mb-6">
              <div className={`flex flex-col items-center ${step === 'basic' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'basic' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  1
                </div>
                <span className="text-xs mt-1">Details</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`h-1 flex-1 ${step === 'basic' ? 'bg-gray-300' : 'bg-green-500'}`}></div>
              </div>
              <div className={`flex flex-col items-center ${step === 'teeBoxes' ? 'text-green-500' : step !== 'basic' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'teeBoxes' ? 'bg-green-500 text-white' : 
                  step !== 'basic' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  2
                </div>
                <span className="text-xs mt-1">Tees</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`h-1 flex-1 ${step === 'basic' || step === 'teeBoxes' ? 'bg-gray-300' : 'bg-green-500'}`}></div>
              </div>
              <div className={`flex flex-col items-center ${step === 'holeData' ? 'text-green-500' : step === 'review' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'holeData' ? 'bg-green-500 text-white' : 
                  step === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  3
                </div>
                <span className="text-xs mt-1">Holes</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`h-1 flex-1 ${step === 'review' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              </div>
              <div className={`flex flex-col items-center ${step === 'review' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  4
                </div>
                <span className="text-xs mt-1">Review</span>
              </div>
            </div>
            
            {/* Step content */}
            <div className="mb-6">
              {step === 'basic' && (
                <div className="space-y-4">
                  <Input
                    type="text"
                    label="Course Name"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    required
                  />
                  
                  <Input
                    type="text"
                    label="Location"
                    value={courseLocation}
                    onChange={(e) => setCourseLocation(e.target.value)}
                    placeholder="City, State (e.g., Seattle, WA)"
                    helper="Format: City, State (2-letter code)"
                  />
                </div>
              )}
              
              {step === 'teeBoxes' && (
                <TeeBoxForm teeBoxes={teeBoxes} onChange={handleTeeBoxesUpdate} />
              )}
              
              {step === 'holeData' && (
                <HoleDataForm 
                  holeData={holeData} 
                  onChange={handleHoleDataUpdate} 
                  teeBoxes={teeBoxes}
                />
              )}
              
              {step === 'review' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Course Summary</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      <div><strong>Course Name:</strong> {courseName}</div>
                      {courseLocation && <div><strong>Location:</strong> {formatLocation()}</div>}
                      <div><strong>Total Par:</strong> {totalPar}</div>
                      <div><strong>Number of Tees:</strong> {teeBoxes.length}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Tee Boxes</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {teeBoxes.map((teeBox, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                          <div><strong>{teeBox.name}</strong></div>
                          <div className="text-sm">Rating: {teeBox.rating} | Slope: {teeBox.slope} | Yardage: {teeBox.yardage}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-red-500">Course ID is missing</div>
        )}
      </DialogContent>
      <DialogFooter>
        {step !== 'basic' && (
          <Button 
            variant="outline" 
            onClick={handlePrevStep}
            disabled={isLoading}
          >
            Back
          </Button>
        )}
        
        {step !== 'review' ? (
          <Button onClick={handleNextStep} disabled={isLoading}>
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSaveCourse}
            isLoading={isLoading}
          >
            Save Course
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
// src/components/scorecard/CourseSetupModal.tsx
'use client';

import React, { useState } from 'react';
import { doc, updateDoc, collection, getDocs, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeBoxForm } from './TeeBoxForm';
import { HoleDataForm } from './HoleDataForm';

interface CourseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string | null;
  courseName: string;
  onComplete: (courseId: string, data: { par: number }) => void;
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
};

export function CourseSetupModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  onComplete
}: CourseSetupModalProps) {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  
  const [step, setStep] = useState<'teeBoxes' | 'holeData' | 'review'>('teeBoxes');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
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
    }))
  );
  
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
  
  // Navigate to next step
  const handleNextStep = () => {
    if (step === 'teeBoxes') {
      setStep('holeData');
    } else if (step === 'holeData') {
      setStep('review');
    }
  };
  
  // Navigate to previous step
  const handlePrevStep = () => {
    if (step === 'holeData') {
      setStep('teeBoxes');
    } else if (step === 'review') {
      setStep('holeData');
    }
  };
  
  // Save the course setup
  const handleSaveCourse = async () => {
    if (!courseId || !user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Saving course with ID:', courseId);
      console.log('Tee boxes:', teeBoxes);
      console.log('Hole data:', holeData);
      
      const batch = writeBatch(db);
      
      // Update the course with the total par and mark as complete
      const courseRef = doc(db, 'courses', courseId);
      batch.update(courseRef, {
        par: totalPar,
        isComplete: true,
        updatedAt: serverTimestamp()
      });
      
      // Delete any existing tee boxes first to avoid duplicates
      const teeBoxesRef = collection(db, 'courses', courseId, 'teeBoxes');
      const existingTeeBoxes = await getDocs(teeBoxesRef);
      
      console.log(`Found ${existingTeeBoxes.size} existing tee boxes to delete`);
      existingTeeBoxes.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Save tee boxes
      for (const teeBox of teeBoxes) {
        const teeBoxData = {
          name: teeBox.name,
          color: teeBox.color,
          rating: teeBox.rating,
          slope: teeBox.slope,
          yardage: teeBox.yardage,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // Use the batch to add the tee box
        const newTeeBoxRef = doc(collection(db, 'courses', courseId, 'teeBoxes'));
        console.log(`Adding tee box with ID: ${newTeeBoxRef.id}, Name: ${teeBox.name}`);
        batch.set(newTeeBoxRef, teeBoxData);
      }
      
      // Save hole data
      const holesRef = collection(db, 'courses', courseId, 'holes');
      
      // Delete any existing holes first
      const existingHoles = await getDocs(holesRef);
      console.log(`Found ${existingHoles.size} existing holes to delete`);
      existingHoles.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add each hole to the batch
      holeData.forEach(hole => {
        const holeRef = doc(holesRef, hole.number.toString());
        console.log(`Adding hole ${hole.number} with par ${hole.par}`);
        batch.set(holeRef, {
          ...hole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      // Commit all changes in the batch
      await batch.commit();
      console.log('Successfully committed all changes to Firestore');
      
      showNotification({
        type: 'success',
        title: 'Course Setup Complete',
        description: `${courseName} has been set up successfully!`
      });
      
      // Notify parent component
      onComplete(courseId, { par: totalPar });
      
    } catch (error) {
      console.error('Error saving course setup:', error);
      setError('Failed to save course setup. Please try again.');
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to save course setup. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen && !!courseId} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {step === 'teeBoxes' && 'Set Up Tee Boxes'}
          {step === 'holeData' && 'Set Up Hole Data'}
          {step === 'review' && 'Review Course Setup'}
        </DialogTitle>
      </DialogHeader>
      <DialogContent className="max-w-2xl">
        {courseId && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold">{courseName}</h2>
              <div className="text-sm text-gray-500">
                Configure your course details so other players can use it
              </div>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-50 text-red-500 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            
            {/* Step indicator */}
            <div className="flex justify-between mb-6">
              <div className={`flex flex-col items-center ${step === 'teeBoxes' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'teeBoxes' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  1
                </div>
                <span className="text-xs mt-1">Tee Boxes</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`h-1 flex-1 ${step === 'teeBoxes' ? 'bg-gray-300' : 'bg-green-500'}`}></div>
              </div>
              <div className={`flex flex-col items-center ${step === 'holeData' ? 'text-green-500' : step === 'review' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'holeData' ? 'bg-green-500 text-white' : 
                  step === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  2
                </div>
                <span className="text-xs mt-1">Hole Data</span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`h-1 flex-1 ${step === 'review' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              </div>
              <div className={`flex flex-col items-center ${step === 'review' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  3
                </div>
                <span className="text-xs mt-1">Review</span>
              </div>
            </div>
            
            {/* Step content */}
            <div className="mb-6">
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
        )}
      </DialogContent>
      <DialogFooter>
        {step !== 'teeBoxes' && (
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
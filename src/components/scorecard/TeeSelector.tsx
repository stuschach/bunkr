// src/components/scorecard/TeeSelector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { TeeBox } from '@/types/scorecard';
import { useNotification } from '@/lib/contexts/NotificationContext';

interface TeeSelectorProps {
  onTeeSelected: (teeBox: TeeBox) => void;
  initialTeeBox?: TeeBox;
  courseId?: string; // Course ID for fetching tee boxes
}

// Common tee box options (as fallback)
const commonTeeOptions = [
  { name: 'Championship', color: 'bg-black text-white' },
  { name: 'Blue', color: 'bg-blue-600 text-white' },
  { name: 'White', color: 'bg-white border border-gray-300 text-gray-800' },
  { name: 'Gold', color: 'bg-yellow-500 text-black' },
  { name: 'Yellow', color: 'bg-yellow-300 text-black' }, 
  { name: 'Red', color: 'bg-red-600 text-white' },
  { name: 'Green', color: 'bg-green-600 text-white' },
];

export function TeeSelector({ onTeeSelected, initialTeeBox, courseId }: TeeSelectorProps) {
  const { showNotification } = useNotification();
  
  const [teeBox, setTeeBox] = useState<TeeBox>(initialTeeBox || {
    name: 'White',
    rating: 72.0,
    slope: 113,
    yardage: 6200
  });
  
  // State for course tee boxes
  const [courseTeeBoxes, setCourseTeeBoxes] = useState<TeeBox[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch tee boxes for the course if courseId is provided
  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourseTeeBoxes = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching tee boxes for course: ${courseId}`);
        
        // First, check if the course exists and is properly set up
        const courseRef = doc(db, 'courses', courseId);
        const courseDoc = await getDoc(courseRef);
        
        if (!courseDoc.exists()) {
          console.error(`Course with ID ${courseId} does not exist`);
          setError('Course not found');
          setIsLoading(false);
          return;
        }
        
        const courseData = courseDoc.data();
        console.log('Course data:', courseData);
        
        // Fetch tee boxes from the subcollection
        const teeBoxesRef = collection(db, 'courses', courseId, 'teeBoxes');
        const teeBoxesSnapshot = await getDocs(query(teeBoxesRef));
        
        console.log(`Found ${teeBoxesSnapshot.size} tee boxes for course ${courseId}`);
        
        if (!teeBoxesSnapshot.empty) {
          const teeBoxes = teeBoxesSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`Tee box ${doc.id}:`, data);
            
            return {
              id: doc.id,
              name: data.name || 'Unknown',
              color: data.color || '',
              rating: data.rating || 72.0,
              slope: data.slope || 113,
              yardage: data.yardage || 6200
            };
          });
          
          setCourseTeeBoxes(teeBoxes);
          
          // If we have tee boxes and no initial tee box was provided,
          // select the first one
          if (teeBoxes.length > 0 && (!initialTeeBox || !initialTeeBox.id)) {
            const firstTeeBox = teeBoxes[0];
            console.log('Auto-selecting tee box:', firstTeeBox);
            setTeeBox(firstTeeBox);
            onTeeSelected(firstTeeBox);
          }
        } else {
          console.log(`No tee boxes found for course: ${courseId}`);
          
          // If the course is marked as complete but has no tee boxes, show a notification
          if (courseData.isComplete) {
            setError('This course is missing tee box information');
            showNotification({
              type: 'warning',
              title: 'Course Data Issue',
              description: 'This course is marked as complete but has no tee box information'
            });
          }
        }
      } catch (error) {
        console.error('Error fetching course tee boxes:', error);
        setError('Failed to load tee boxes');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCourseTeeBoxes();
  }, [courseId, initialTeeBox, onTeeSelected, showNotification]);
  
  // Handle tee name selection
  const handleSelectTee = (teeName: string) => {
    // Try to find the selected tee in the course tee boxes
    const selectedTeeBox = courseTeeBoxes.find(tb => tb.name === teeName);
    
    if (selectedTeeBox) {
      // Use the course tee box
      console.log('Selected existing tee box:', selectedTeeBox);
      setTeeBox(selectedTeeBox);
      onTeeSelected(selectedTeeBox);
    } else {
      // Use a default tee box
      const newTeeBox = { ...teeBox, name: teeName };
      console.log('Created new tee box with defaults:', newTeeBox);
      setTeeBox(newTeeBox);
      onTeeSelected(newTeeBox);
    }
  };
  
  // Handle tee rating change
  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      const newTeeBox = { ...teeBox, rating: value };
      setTeeBox(newTeeBox);
      onTeeSelected(newTeeBox);
    }
  };
  
  // Handle slope rating change
  const handleSlopeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      const newTeeBox = { ...teeBox, slope: value };
      setTeeBox(newTeeBox);
      onTeeSelected(newTeeBox);
    }
  };
  
  // Handle yardage change
  const handleYardageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      const newTeeBox = { ...teeBox, yardage: value };
      setTeeBox(newTeeBox);
      onTeeSelected(newTeeBox);
    }
  };
  
  // Helper: get color class for a tee name
  const getTeeColorClass = (teeName: string): string => {
    const option = commonTeeOptions.find(opt => opt.name === teeName);
    return option ? option.color : 'bg-gray-200 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Tee Box
        </label>
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" color="primary" />
          </div>
        ) : error ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md mb-4 text-yellow-800 dark:text-yellow-200">
            {error}
            <p className="text-sm mt-1">You can still manually select a tee and enter details below.</p>
          </div>
        ) : null}
        
        {courseTeeBoxes.length > 0 ? (
          // Course has tee boxes - show them
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {courseTeeBoxes.map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`px-3 py-2 rounded-md text-center text-sm ${
                  getTeeColorClass(tb.name)
                } ${
                  teeBox.name === tb.name
                    ? 'ring-2 ring-green-500 ring-offset-2'
                    : 'hover:opacity-80'
                }`}
                onClick={() => handleSelectTee(tb.name)}
              >
                {tb.name}
              </button>
            ))}
          </div>
        ) : (
          // No course tee boxes - show defaults
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {commonTeeOptions.map((tee) => (
              <button
                key={tee.name}
                type="button"
                className={`px-3 py-2 rounded-md text-center text-sm ${tee.color} ${
                  teeBox.name === tee.name
                    ? 'ring-2 ring-green-500 ring-offset-2'
                    : 'hover:opacity-80'
                }`}
                onClick={() => handleSelectTee(tee.name)}
              >
                {tee.name}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          type="number"
          label="Course Rating"
          value={teeBox.rating}
          onChange={handleRatingChange}
          min="60"
          max="80"
          step="0.1"
          helper="Usually between 65-75"
        />
        
        <Input
          type="number"
          label="Slope Rating"
          value={teeBox.slope}
          onChange={handleSlopeChange}
          min="55"
          max="155"
          helper="Usually between 100-150"
        />
        
        <Input
          type="number"
          label="Yardage"
          value={teeBox.yardage}
          onChange={handleYardageChange}
          min="1000"
          max="8000"
          helper="Total course yardage"
        />
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs text-gray-500 dark:text-gray-400">
        <p>
          <strong>Course rating</strong> and <strong>slope</strong> are used for handicap calculation. 
          You can find these values on the scorecard at your course.
        </p>
      </div>
    </div>
  );
}
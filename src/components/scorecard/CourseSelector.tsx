// src/components/scorecard/CourseSelector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useNotification } from '@/lib/contexts/NotificationContext';

interface CourseData {
  id: string;
  name: string;
  location: string;
  par: number;
  createdBy?: string;
  createdAt?: any;
}

interface CourseSelectorProps {
  onCourseSelected: (course: { id: string; name: string; par: number }) => void;
  initialCourseId?: string;
  initialCourseName?: string;
}

export function CourseSelector({ 
  onCourseSelected, 
  initialCourseId, 
  initialCourseName 
}: CourseSelectorProps) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [searchText, setSearchText] = useState<string>('');
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [recentlyAddedCourses, setRecentlyAddedCourses] = useState<CourseData[]>([]);
  
  // If initial course is provided, set it as selected
  useEffect(() => {
    if (initialCourseId && initialCourseName) {
      setSelectedCourse({
        id: initialCourseId,
        name: initialCourseName,
        location: '',
        par: 72, // Default par, will be updated from Firestore if needed
      });
    }
    
    // Load recently added courses by the user
    loadRecentlyAddedCourses();
  }, [initialCourseId, initialCourseName, user]);

  // Load recently added courses by the user
  const loadRecentlyAddedCourses = async () => {
    if (!user) return;
    
    try {
      const coursesRef = collection(db, 'courses');
      const q = query(
        coursesRef,
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);
      const coursesData: CourseData[] = [];
      
      querySnapshot.forEach((doc) => {
        coursesData.push({
          id: doc.id,
          name: doc.data().name,
          location: doc.data().location?.city ? `${doc.data().location.city}, ${doc.data().location.state}` : '',
          par: doc.data().par || 72,
          createdAt: doc.data().createdAt
        });
      });
      
      setRecentlyAddedCourses(coursesData);
    } catch (error) {
      console.error('Error loading recently added courses:', error);
    }
  };

  // Search for courses
  const searchCourses = async () => {
    if (!searchText.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      const coursesRef = collection(db, 'courses');
      const q = query(
        coursesRef,
        where('nameTokens', 'array-contains', searchText.toLowerCase()),
        orderBy('name'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const coursesData: CourseData[] = [];
      
      querySnapshot.forEach((doc) => {
        coursesData.push({
          id: doc.id,
          name: doc.data().name,
          location: doc.data().location?.city ? `${doc.data().location.city}, ${doc.data().location.state}` : '',
          par: doc.data().par || 72
        });
      });
      
      setCourses(coursesData);
    } catch (error) {
      console.error('Error searching courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle course selection
  const handleSelectCourse = (course: CourseData) => {
    setSelectedCourse(course);
    setShowResults(false);
    onCourseSelected({
      id: course.id,
      name: course.name,
      par: course.par
    });
  };

  // Handle manual course creation and save to database
  const handleManualEntry = async () => {
    if (!user) {
      showNotification({
        type: 'error',
        title: 'Authentication required',
        description: 'You must be logged in to add a new course'
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Prepare course data
      const courseData = {
        name: searchText.trim(),
        nameTokens: generateSearchTokens(searchText),
        par: 72, // Default par value
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        location: null,
        isManualEntry: true, // Flag to identify manually added courses
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'courses'), courseData);
      
      // Create course object with the new ID
      const newCourse = {
        id: docRef.id,
        name: searchText,
        location: '',
        par: 72
      };
      
      // Success notification
      showNotification({
        type: 'success',
        title: 'Course Added',
        description: `"${searchText}" has been added to your courses`
      });
      
      // Update state and trigger callback
      setSelectedCourse(newCourse);
      setShowResults(false);
      onCourseSelected({
        id: newCourse.id,
        name: newCourse.name,
        par: newCourse.par
      });
      
      // Refresh recently added courses
      loadRecentlyAddedCourses();
    } catch (error) {
      console.error('Error adding course:', error);
      showNotification({
        type: 'error',
        title: 'Error',
        description: 'Failed to add the course. Please try again.'
      });
    } finally {
      setIsSaving(false);
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
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Golf Course
      </label>
      
      {selectedCourse ? (
        <div className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
          <div>
            <div className="font-medium">{selectedCourse.name}</div>
            {selectedCourse.location && (
              <div className="text-sm text-gray-500">{selectedCourse.location}</div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCourse(null);
              setSearchText('');
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <div className="flex">
              <Input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search for a golf course"
                className="flex-grow"
              />
              <Button
                type="button"
                onClick={searchCourses}
                disabled={isLoading || !searchText.trim()}
                className="ml-2"
              >
                {isLoading ? <LoadingSpinner size="sm" color="light" /> : 'Search'}
              </Button>
            </div>
            
            {showResults && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg">
                {isLoading ? (
                  <div className="p-4 text-center">
                    <LoadingSpinner size="sm" color="primary" />
                  </div>
                ) : courses.length > 0 ? (
                  <ul className="max-h-60 overflow-auto">
                    {courses.map((course) => (
                      <li
                        key={course.id}
                        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleSelectCourse(course)}
                      >
                        <div className="font-medium">{course.name}</div>
                        {course.location && (
                          <div className="text-sm text-gray-500">{course.location}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4">
                    <div className="text-gray-500 mb-2">No courses found with that name.</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualEntry}
                      isLoading={isSaving}
                    >
                      Add "{searchText}" manually
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Recently Added Courses */}
          {recentlyAddedCourses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Recently Added Courses</h3>
              <div className="grid grid-cols-1 gap-2">
                {recentlyAddedCourses.map((course) => (
                  <button
                    key={course.id}
                    className="text-left p-2 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleSelectCourse(course)}
                  >
                    <div className="font-medium">{course.name}</div>
                    <div className="text-xs text-gray-500">
                      Par {course.par}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
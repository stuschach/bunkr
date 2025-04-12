// src/components/scorecard/CourseSelector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { CourseSetupModal } from './CourseSetupModal';
import { CourseEditModal } from './CourseEditModal';
import { formatLocationString, parseLocationString } from '@/lib/utils/location-formatter';

interface CourseData {
  id: string;
  name: string;
  location: string;
  par: number;
  createdBy?: string;
  createdAt?: any;
  isComplete?: boolean;
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
  const [locationInput, setLocationInput] = useState<string>('');
  
  // State for modals
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newCourseId, setNewCourseId] = useState<string | null>(null);
  
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
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name,
          location: data.location?.formattedLocation || (data.location?.city ? `${data.location.city}, ${data.location.state}` : ''),
          par: data.par || 72,
          createdAt: data.createdAt,
          isComplete: data.isComplete || false,
          createdBy: data.createdBy
        });
      });
      
      setRecentlyAddedCourses(coursesData);
    } catch (error) {
      console.error('Error loading recently added courses:', error);
    }
  };

  // Format location input to standardized format
  const formatLocation = (input: string) => {
    if (!input.trim()) return '';
    
    return formatLocationString(input);
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
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name,
          location: data.location?.formattedLocation || (data.location?.city ? `${data.location.city}, ${data.location.state}` : ''),
          par: data.par || 72,
          isComplete: data.isComplete || false,
          createdBy: data.createdBy
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
  const handleSelectCourse = async (course: CourseData) => {
    setSelectedCourse(course);
    setShowResults(false);
    
    // Check if the course has tee boxes and hole data
    const teeBoxesRef = collection(db, 'courses', course.id, 'teeBoxes');
    const teeBoxesSnapshot = await getDocs(teeBoxesRef);
    
    // If this is the user's course and it's not complete, offer to complete setup
    if (course.createdBy === user?.uid && !course.isComplete && teeBoxesSnapshot.empty) {
      setNewCourseId(course.id);
      setIsSetupModalOpen(true);
    } else {
      onCourseSelected({
        id: course.id,
        name: course.name,
        par: course.par
      });
    }
  };

  // Handle course edit
  const handleEditCourse = (course: CourseData) => {
    setSelectedCourse(course);
    setNewCourseId(course.id);
    setIsEditModalOpen(true);
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
      // Format the location if provided
      const formattedLocation = formatLocation(locationInput);
      const { city, state } = parseLocationString(formattedLocation);
      
      // Prepare course data
      const courseData = {
        name: searchText.trim(),
        nameTokens: generateSearchTokens(searchText),
        par: 72, // Default par value
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        location: formattedLocation ? {
          city,
          state,
          formattedLocation
        } : null,
        isManualEntry: true, // Flag to identify manually added courses
        isComplete: false,   // Flag to track if course setup is complete
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'courses'), courseData);
      
      // Create course object with the new ID
      const newCourse = {
        id: docRef.id,
        name: searchText,
        location: formattedLocation,
        par: 72,
        createdBy: user.uid,
        isComplete: false
      };
      
      // Success notification
      showNotification({
        type: 'success',
        title: 'Course Added',
        description: `"${searchText}" has been added to your courses`
      });
      
      // Set the new course ID to open the setup modal
      setNewCourseId(docRef.id);
      setIsSetupModalOpen(true);
      
      // Update state and trigger callback
      setSelectedCourse(newCourse);
      setShowResults(false);
      
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

  // Handle course setup completion
  const handleSetupComplete = (courseId: string, updatedData: { par: number }) => {
    // Update the selected course with the new data
    if (selectedCourse) {
      const updatedCourse = {
        ...selectedCourse,
        par: updatedData.par,
        isComplete: true
      };
      setSelectedCourse(updatedCourse);
      
      // Notify parent component
      onCourseSelected({
        id: updatedCourse.id,
        name: updatedCourse.name,
        par: updatedCourse.par
      });
    }
    
    // Close the modal
    setIsSetupModalOpen(false);
    
    // Show success notification
    showNotification({
      type: 'success',
      title: 'Course Setup Complete',
      description: 'Your course has been fully set up and is ready for use'
    });
    
    // Refresh recently added courses
    loadRecentlyAddedCourses();
  };

  // Handle course edit completion
  const handleEditComplete = (courseId: string, updatedData: { par: number, name: string, location?: string }) => {
    // Update the selected course with the new data
    if (selectedCourse) {
      const updatedCourse = {
        ...selectedCourse,
        par: updatedData.par,
        name: updatedData.name,
        location: updatedData.location || selectedCourse.location,
        isComplete: true
      };
      setSelectedCourse(updatedCourse);
      
      // Notify parent component
      onCourseSelected({
        id: updatedCourse.id,
        name: updatedCourse.name,
        par: updatedCourse.par
      });
    }
    
    // Close the modal
    setIsEditModalOpen(false);
    
    // Show success notification
    showNotification({
      type: 'success',
      title: 'Course Updated',
      description: 'Your course has been updated successfully'
    });
    
    // Refresh recently added courses
    loadRecentlyAddedCourses();
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
            {selectedCourse.isComplete === false && (
              <div className="mt-1">
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  Setup incomplete
                </span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            {/* Show edit button if user is the creator */}
            {selectedCourse.createdBy === user?.uid && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditCourse(selectedCourse)}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCourse(null);
                setSearchText('');
                setLocationInput('');
              }}
            >
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <div className="flex flex-col space-y-2">
              <Input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search for a golf course"
                className="flex-grow"
              />
              
              <Input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="City, State (e.g., Seattle, WA)"
                className="flex-grow"
              />
              
              <div className="flex">
                <Button
                  type="button"
                  onClick={searchCourses}
                  disabled={isLoading || !searchText.trim()}
                  className="ml-auto"
                >
                  {isLoading ? <LoadingSpinner size="sm" color="light" /> : 'Search'}
                </Button>
              </div>
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
                        <div className="font-medium">
                          {course.name}
                          {!course.isComplete && course.createdBy === user?.uid && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                              Setup needed
                            </span>
                          )}
                        </div>
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
          
          {/* Recently Added Courses - FIXED TO PREVENT BUTTON NESTING */}
          {recentlyAddedCourses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Recently Added Courses</h3>
              <div className="grid grid-cols-1 gap-2">
                {recentlyAddedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="text-left p-2 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex justify-between items-center">
                      <div 
                        className="flex-grow cursor-pointer"
                        onClick={() => handleSelectCourse(course)}
                      >
                        <div className="font-medium">
                          {course.name}
                          {!course.isComplete && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                              Setup needed
                            </span>
                          )}
                        </div>
                        {course.location && (
                          <div className="text-xs text-gray-500">{course.location}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          Par {course.par}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCourse(course)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Course Setup Modal */}
      <CourseSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        courseId={newCourseId}
        courseName={selectedCourse?.name || ''}
        onComplete={handleSetupComplete}
      />
      
      {/* Course Edit Modal */}
      <CourseEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        courseId={newCourseId}
        initialCourse={selectedCourse}
        onComplete={handleEditComplete}
      />
    </div>
  );
}
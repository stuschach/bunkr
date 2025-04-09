// src/components/handicap/HandicapCalculator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { scoreToScoreDifferential } from '@/lib/handicap/differentials';
import { calculateHandicapIndex, calculateCourseHandicap } from '@/lib/handicap/calculator';
import { formatHandicapIndex } from '@/lib/utils/formatting';

interface ScoreEntry {
  id: string;
  score: number;
  courseRating: number;
  slopeRating: number;
  scoreDifferential: number | null;
}

export function HandicapCalculator() {
  // State for the list of score entries
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([
    { id: '1', score: 90, courseRating: 72.0, slopeRating: 113, scoreDifferential: null },
  ]);
  
  // State for the calculated handicap index
  const [handicapIndex, setHandicapIndex] = useState<number | null>(null);
  
  // State for new course info (for course handicap calculation)
  const [newCourseInfo, setNewCourseInfo] = useState({
    courseRating: 72.0,
    slopeRating: 113,
    coursePar: 72
  });
  
  // State for the calculated course handicap
  const [courseHandicap, setCourseHandicap] = useState<number | null>(null);
  
  // Calculate score differentials when entries change
  useEffect(() => {
    const updatedEntries = scoreEntries.map(entry => ({
      ...entry,
      scoreDifferential: entry.score && entry.courseRating && entry.slopeRating
        ? scoreToScoreDifferential(entry.score, entry.courseRating, entry.slopeRating)
        : null
    }));
    
    setScoreEntries(updatedEntries);
  }, []);
  
  // Add a new empty score entry
  const addScoreEntry = () => {
    const newId = Date.now().toString();
    setScoreEntries([
      ...scoreEntries,
      { id: newId, score: 90, courseRating: 72.0, slopeRating: 113, scoreDifferential: null }
    ]);
  };
  
  // Update a score entry
  const updateScoreEntry = (id: string, field: keyof ScoreEntry, value: number) => {
    const updatedEntries = scoreEntries.map(entry => {
      if (entry.id === id) {
        const updatedEntry = { ...entry, [field]: value };
        
        // Recalculate the score differential
        updatedEntry.scoreDifferential = scoreToScoreDifferential(
          updatedEntry.score, 
          updatedEntry.courseRating, 
          updatedEntry.slopeRating
        );
        
        return updatedEntry;
      }
      return entry;
    });
    
    setScoreEntries(updatedEntries);
  };
  
  // Remove a score entry
  const removeScoreEntry = (id: string) => {
    setScoreEntries(scoreEntries.filter(entry => entry.id !== id));
  };
  
  // Calculate the handicap index
  const calculateHandicap = () => {
    // Create mock scorecards from the score entries
    const mockScorecards = scoreEntries.map(entry => ({
      id: entry.id,
      userId: 'calculator',
      courseId: 'calculator',
      courseName: 'Calculator',
      date: new Date().toISOString().split('T')[0],
      totalScore: entry.score,
      coursePar: 72,
      courseHandicap: null,
      holes: [],
      teeBox: {
        name: 'Calculator',
        rating: entry.courseRating,
        slope: entry.slopeRating,
        yardage: 0
      },
      stats: {
        totalPutts: 0,
        fairwaysHit: 0,
        fairwaysTotal: 0,
        greensInRegulation: 0,
        penalties: 0
      },
      isPublic: false,
      scoreToPar: 0
    }));
    
    // Calculate the handicap index
    const calculatedIndex = calculateHandicapIndex(mockScorecards);
    setHandicapIndex(calculatedIndex);
    
    // If handicap index was calculated and new course info is filled out,
    // also calculate the course handicap
    if (calculatedIndex !== null) {
      const calculatedCourseHandicap = calculateCourseHandicap(
        calculatedIndex,
        newCourseInfo.slopeRating,
        newCourseInfo.courseRating,
        newCourseInfo.coursePar
      );
      setCourseHandicap(calculatedCourseHandicap);
    }
  };
  
  // Update new course info
  const updateNewCourseInfo = (field: keyof typeof newCourseInfo, value: number) => {
    setNewCourseInfo({
      ...newCourseInfo,
      [field]: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Handicap Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Introduction */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md text-sm">
          <p>
            Enter your golf scores along with the course rating and slope to calculate your 
            USGA Handicap Index. For accurate results, enter at least 3 rounds.
          </p>
        </div>
        
        {/* Score entries */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Your Scores</h3>
          
          {scoreEntries.map((entry, index) => (
            <div 
              key={entry.id} 
              className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border border-gray-200 dark:border-gray-800 rounded-md"
            >
              <div>
                <Input
                  type="number"
                  label="Score"
                  value={entry.score}
                  onChange={(e) => updateScoreEntry(entry.id, 'score', Number(e.target.value))}
                  min="50"
                  max="150"
                />
              </div>
              
              <div>
                <Input
                  type="number"
                  label="Course Rating"
                  value={entry.courseRating}
                  onChange={(e) => updateScoreEntry(entry.id, 'courseRating', Number(e.target.value))}
                  min="60"
                  max="80"
                  step="0.1"
                />
              </div>
              
              <div>
                <Input
                  type="number"
                  label="Slope Rating"
                  value={entry.slopeRating}
                  onChange={(e) => updateScoreEntry(entry.id, 'slopeRating', Number(e.target.value))}
                  min="55"
                  max="155"
                />
              </div>
              
              <div className="flex items-end space-x-2">
                <div className="flex-grow">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Differential
                  </div>
                  <div className="h-10 flex items-center px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                    {entry.scoreDifferential !== null 
                      ? entry.scoreDifferential.toFixed(1) 
                      : '-'}
                  </div>
                </div>
                
                {/* Only show remove button if there's more than one entry */}
                {scoreEntries.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => removeScoreEntry(entry.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {/* Add another score button */}
          <Button 
            type="button" 
            variant="outline" 
            onClick={addScoreEntry}
          >
            + Add Another Score
          </Button>
        </div>
        
        {/* Course information for calculating course handicap */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <h3 className="text-sm font-medium mb-4">Calculate Course Handicap</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Course Rating"
              value={newCourseInfo.courseRating}
              onChange={(e) => updateNewCourseInfo('courseRating', Number(e.target.value))}
              min="60"
              max="80"
              step="0.1"
            />
            
            <Input
              type="number"
              label="Slope Rating"
              value={newCourseInfo.slopeRating}
              onChange={(e) => updateNewCourseInfo('slopeRating', Number(e.target.value))}
              min="55"
              max="155"
            />
            
            <Input
              type="number"
              label="Course Par"
              value={newCourseInfo.coursePar}
              onChange={(e) => updateNewCourseInfo('coursePar', Number(e.target.value))}
              min="68"
              max="76"
            />
          </div>
        </div>
        
        {/* Calculate button */}
        <div className="text-center pt-4">
          <Button onClick={calculateHandicap}>
            Calculate Handicap
          </Button>
        </div>
        
        {/* Results */}
        {handicapIndex !== null && (
          <div className="mt-6 p-4 border border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 rounded-md">
            <h3 className="text-lg font-bold text-center mb-2">Your Handicap</h3>
            
            <div className="flex justify-around text-center">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Handicap Index
                </div>
                <div className="text-3xl font-bold">
                  {formatHandicapIndex(handicapIndex)}
                </div>
              </div>
              
              {courseHandicap !== null && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Course Handicap
                  </div>
                  <div className="text-3xl font-bold">
                    {courseHandicap}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
              This is calculated using the USGA™ Handicap System formula.
              {scoreEntries.length < 20 && (
                <div className="mt-1 text-xs">
                  Note: A full handicap index uses 20 rounds. Your index may change as you add more scores.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
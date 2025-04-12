// src/components/scorecard/HoleByHole.tsx
'use client';

import React, { useState } from 'react';
import { HoleData } from '@/types/scorecard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';
import { HoleInput } from './HoleInput';

interface HoleByHoleProps {
  holes: HoleData[];
  updateHoleData: (holeNumber: number, data: Partial<HoleData>) => void;
  coursePar: number;
  readonly?: boolean;
  isLoadingCourseData?: boolean;
}

export function HoleByHole({ 
  holes, 
  updateHoleData, 
  coursePar,
  readonly = false,
  isLoadingCourseData = false
}: HoleByHoleProps) {
  const [currentPage, setCurrentPage] = useState<'front9' | 'back9'>('front9');
  const [expandedHole, setExpandedHole] = useState<number | null>(null);
  
  // Calculate front 9, back 9, and total scores
  const front9Scores = holes.slice(0, 9);
  const back9Scores = holes.slice(9, 18);
  
  const front9Par = front9Scores.reduce((sum, hole) => sum + hole.par, 0);
  const back9Par = back9Scores.reduce((sum, hole) => sum + hole.par, 0);
  const totalPar = front9Par + back9Par;
  
  const front9Score = front9Scores.reduce((sum, hole) => sum + (hole.score || 0), 0);
  const back9Score = back9Scores.reduce((sum, hole) => sum + (hole.score || 0), 0);
  const totalScore = front9Score + back9Score;
  
  // Function to determine score color based on relation to par
  const getScoreColor = (score: number, par: number) => {
    if (score === 0) return 'text-gray-400'; // Not played yet
    const diff = score - par;
    if (diff < 0) return 'text-green-500'; // Under par
    if (diff === 0) return 'text-gray-700 dark:text-gray-300'; // Par
    if (diff === 1) return 'text-red-500'; // Bogey
    return 'text-red-600'; // Double bogey or worse
  };
  
  // Toggle hole expansion for detailed data entry
  const toggleHoleExpansion = (holeNumber: number) => {
    if (expandedHole === holeNumber) {
      setExpandedHole(null);
    } else {
      setExpandedHole(holeNumber);
    }
  };

  return (
    <div>
      {isLoadingCourseData && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-blue-700 dark:text-blue-300 flex items-center space-x-2 mb-4">
          <LoadingSpinner size="sm" color="primary" />
          <span>Loading hole information from course data...</span>
        </div>
      )}
      
      {/* Page toggle for Front 9 / Back 9 */}
      <div className="flex mb-4">
        <Button
          type="button"
          variant={currentPage === 'front9' ? 'primary' : 'outline'}
          className="rounded-r-none flex-1"
          onClick={() => setCurrentPage('front9')}
        >
          Front 9
        </Button>
        <Button
          type="button"
          variant={currentPage === 'back9' ? 'primary' : 'outline'}
          className="rounded-l-none flex-1"
          onClick={() => setCurrentPage('back9')}
        >
          Back 9
        </Button>
      </div>
      
      {/* Scorecard Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hole
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Par
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              {!readonly && (
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {/* Display either front 9 or back 9 based on currentPage */}
            {(currentPage === 'front9' ? front9Scores : back9Scores).map((hole, index) => {
              const actualHoleNumber = currentPage === 'front9' ? index + 1 : index + 10;
              const isExpanded = expandedHole === actualHoleNumber;
              
              return (
                <React.Fragment key={actualHoleNumber}>
                  <tr className={isExpanded ? 'bg-gray-50 dark:bg-gray-800' : ''}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{actualHoleNumber}</span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {readonly ? (
                        hole.par
                      ) : (
                        <select
                          value={hole.par}
                          onChange={(e) => updateHoleData(actualHoleNumber, { par: parseInt(e.target.value) })}
                          className="w-16 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700"
                        >
                          {[3, 4, 5, 6].map((parValue) => (
                            <option key={parValue} value={parValue}>
                              {parValue}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {readonly ? (
                        <span className={getScoreColor(hole.score, hole.par)}>
                          {hole.score || '-'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          max="15"
                          value={hole.score || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : 0;
                            updateHoleData(actualHoleNumber, { score: value });
                          }}
                          className={`w-16 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700 ${
                            hole.score ? getScoreColor(hole.score, hole.par) : ''
                          }`}
                        />
                      )}
                    </td>
                    {!readonly && (
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleHoleExpansion(actualHoleNumber)}
                        >
                          {isExpanded ? 'Close' : 'Details'}
                        </Button>
                      </td>
                    )}
                  </tr>
                  
                  {/* Expanded hole details */}
                  {isExpanded && !readonly && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 bg-gray-50 dark:bg-gray-800">
                        <HoleInput
                          hole={hole}
                          updateHoleData={(data) => updateHoleData(actualHoleNumber, data)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Totals row */}
            <tr className="bg-gray-100 dark:bg-gray-800 font-medium">
              <td className="px-3 py-2 whitespace-nowrap">
                {currentPage === 'front9' ? 'OUT' : 'IN'}
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                {currentPage === 'front9' ? front9Par : back9Par}
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                <span className={getScoreColor(
                  currentPage === 'front9' ? front9Score : back9Score,
                  currentPage === 'front9' ? front9Par : back9Par
                )}>
                  {currentPage === 'front9' ? front9Score : back9Score}
                </span>
              </td>
              {!readonly && <td></td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Total Score Display */}
      <div className="mt-6 flex flex-col items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Score</div>
        <div className="text-3xl font-bold text-center mb-1">
          {formatScoreWithRelationToPar(totalScore, totalPar)}
        </div>
        <div className="flex space-x-2 mt-2">
          {totalScore > 0 && holes.some(h => h.score > 0) && (
            <>
              <Badge variant={front9Score < front9Par ? 'success' : 'secondary'}>
                Front: {front9Score}
              </Badge>
              <Badge variant={back9Score < back9Par ? 'success' : 'secondary'}>
                Back: {back9Score}
              </Badge>
            </>
          )}
        </div>
      </div>
      
      {/* Quick Par Setup */}
      {!readonly && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium mb-2">Quick Par Setup</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Set all par 4
                const updatedHoles = [...holes];
                updatedHoles.forEach(hole => {
                  updateHoleData(hole.number, { par: 4 });
                });
              }}
            >
              All Par 4
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Standard course - 4 par 3s, 4 par 5s, rest par 4s
                [2, 7, 11, 16].forEach(holeNum => {
                  updateHoleData(holeNum, { par: 3 });
                });
                
                [4, 9, 13, 18].forEach(holeNum => {
                  updateHoleData(holeNum, { par: 5 });
                });
                
                // Set remaining holes to par 4
                holes.forEach(hole => {
                  if (![2, 4, 7, 9, 11, 13, 16, 18].includes(hole.number)) {
                    updateHoleData(hole.number, { par: 4 });
                  }
                });
              }}
            >
              Standard Layout
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Front 9 setup
                [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((holeNum, idx) => {
                  updateHoleData(holeNum, { par: currentPage === 'front9' ? 4 : holes[idx].par });
                });
              }}
            >
              Front 9 All Par 4
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Back 9 setup
                [10, 11, 12, 13, 14, 15, 16, 17, 18].forEach((holeNum, idx) => {
                  updateHoleData(holeNum, { par: currentPage === 'back9' ? 4 : holes[idx + 9].par });
                });
              }}
            >
              Back 9 All Par 4
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
// src/components/scorecard/LiveScoring/ScoreInput.tsx
'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface ScoreInputProps {
  currentValue: number;
  par: number;
  onScoreSelected: (score: number) => void;
  disabled?: boolean;
}

export function ScoreInput({ 
  currentValue, 
  par, 
  onScoreSelected,
  disabled = false 
}: ScoreInputProps) {
  // Helper to generate score label based on par
  const getScoreLabel = (score: number, par: number) => {
    const diff = score - par;
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    if (diff === 3) return 'Triple';
    if (diff > 3) return `+${diff}`;
    return null; // For scores better than eagle
  };

  // Generate common score options based on par
  const generateScoreOptions = (par: number) => {
    // Common scores around par (two under to three over)
    let options = [];
    
    // For par 3, start with 1
    // For par 4 and 5, start with par - 2 (eagle)
    const minScore = par === 3 ? 1 : par - 2;
    
    // Add scores up to par + 3 (or a minimum of 8)
    const maxScore = Math.max(par + 3, 8);
    
    for (let score = minScore; score <= maxScore; score++) {
      options.push(score);
    }
    
    return options;
  };

  // Get score options
  const scoreOptions = generateScoreOptions(par);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
        Select Score for Hole {par === 3 ? '(Par 3)' : par === 4 ? '(Par 4)' : '(Par 5)'}
      </h3>
      
      <div className="grid grid-cols-4 gap-2">
        {scoreOptions.map(score => {
          const label = getScoreLabel(score, par);
          const isSelected = currentValue === score;
          
          // Determine button style based on score relative to par
          let bgColor = '';
          let textColor = '';
          
          if (score < par) {
            bgColor = isSelected ? 'bg-green-600' : 'bg-green-100 dark:bg-green-900/30';
            textColor = isSelected ? 'text-white' : 'text-green-700 dark:text-green-400';
          } else if (score === par) {
            bgColor = isSelected ? 'bg-gray-600' : 'bg-gray-100 dark:bg-gray-800';
            textColor = isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300';
          } else if (score === par + 1) {
            bgColor = isSelected ? 'bg-red-500' : 'bg-red-100 dark:bg-red-900/30';
            textColor = isSelected ? 'text-white' : 'text-red-700 dark:text-red-400';
          } else {
            bgColor = isSelected ? 'bg-red-600' : 'bg-red-100 dark:bg-red-900/20';
            textColor = isSelected ? 'text-white' : 'text-red-700 dark:text-red-400';
          }
          
          return (
            <button
              key={score}
              className={`${bgColor} ${textColor} rounded-md py-3 flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-50`}
              onClick={() => onScoreSelected(score)}
              disabled={disabled}
            >
              <span className="text-lg font-bold">{score}</span>
              {label && <span className="text-xs opacity-90">{label}</span>}
            </button>
          );
        })}
        
        {/* Additional number options */}
        {[...Array(4)].map((_, index) => {
          const score = scoreOptions[scoreOptions.length - 1] + index + 1;
          return (
            <button
              key={score}
              className={`${currentValue === score ? 'bg-red-700 text-white' : 'bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300'} rounded-md py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-50`}
              onClick={() => onScoreSelected(score)}
              disabled={disabled}
            >
              <span className="text-lg font-bold">{score}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
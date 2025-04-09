// src/components/scorecard/HoleInput.tsx
'use client';

import React from 'react';
import { HoleData } from '@/types/scorecard';
import { Toggle } from '@/components/ui/Toggle';
import { Input } from '@/components/ui/Input';

interface HoleInputProps {
  hole: HoleData;
  updateHoleData: (data: Partial<HoleData>) => void;
}

export function HoleInput({ hole, updateHoleData }: HoleInputProps) {
  // Calculate if the hole is a par 3 (no fairway)
  const isPar3 = hole.par === 3;
  
  // Calculate GIR target (par - 2) putts
  const girTarget = hole.par - 2;
  
  // Handle fairway hit toggle (only for non-par 3s)
  const handleFairwayToggle = (hit: boolean) => {
    updateHoleData({ fairwayHit: hit });
  };
  
  // Handle GIR toggle
  const handleGIRToggle = (hit: boolean) => {
    updateHoleData({ greenInRegulation: hit });
  };
  
  // Handle putts change
  const handlePuttsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const putts = parseInt(e.target.value);
    if (!isNaN(putts) && putts >= 0 && putts <= 10) {
      updateHoleData({ putts });
    }
  };
  
  // Handle penalties change
  const handlePenaltiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const penalties = parseInt(e.target.value);
    if (!isNaN(penalties) && penalties >= 0 && penalties <= 10) {
      updateHoleData({ penalties });
    }
  };
  
  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHoleData({ notes: e.target.value });
  };

  return (
    <div className="p-2 space-y-4">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Hole {hole.number} Details
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fairway Hit (not for par 3s) */}
        {!isPar3 && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Fairway Hit
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => handleFairwayToggle(true)}
                className={`px-3 py-1 text-sm rounded-md ${
                  hole.fairwayHit === true
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Hit
              </button>
              <button
                type="button"
                onClick={() => handleFairwayToggle(false)}
                className={`px-3 py-1 text-sm rounded-md ${
                  hole.fairwayHit === false
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                Missed
              </button>
            </div>
          </div>
        )}
        
        {/* Green in Regulation */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Green in Regulation
            <span className="ml-1 text-gray-400">
              ({girTarget} or fewer strokes to green)
            </span>
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => handleGIRToggle(true)}
              className={`px-3 py-1 text-sm rounded-md ${
                hole.greenInRegulation
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Hit
            </button>
            <button
              type="button"
              onClick={() => handleGIRToggle(false)}
              className={`px-3 py-1 text-sm rounded-md ${
                hole.greenInRegulation === false
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Missed
            </button>
          </div>
        </div>
        
        {/* Putts */}
        <div>
          <Input
            type="number"
            min="0"
            max="10"
            label="Putts"
            value={hole.putts || ''}
            onChange={handlePuttsChange}
          />
        </div>
        
        {/* Penalties */}
        <div>
          <Input
            type="number"
            min="0"
            max="10"
            label="Penalty Strokes"
            value={hole.penalties || ''}
            onChange={handlePenaltiesChange}
          />
        </div>
      </div>
      
      {/* Notes */}
      <div>
        <Input
          type="text"
          label="Notes"
          placeholder="Memorable shots, problems, etc."
          value={hole.notes || ''}
          onChange={handleNotesChange}
        />
      </div>
    </div>
  );
}
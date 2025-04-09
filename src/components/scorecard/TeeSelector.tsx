// src/components/scorecard/TeeSelector.tsx
'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { TeeBox } from '@/types/scorecard';

interface TeeSelectorProps {
  onTeeSelected: (teeBox: TeeBox) => void;
  initialTeeBox?: TeeBox;
}

// Common tee box options
const commonTeeOptions = [
  { name: 'Championship', color: 'bg-black text-white' },
  { name: 'Blue', color: 'bg-blue-600 text-white' },
  { name: 'White', color: 'bg-white border border-gray-300 text-gray-800' },
  { name: 'Gold', color: 'bg-yellow-500 text-black' },
  { name: 'Red', color: 'bg-red-600 text-white' },
  { name: 'Green', color: 'bg-green-600 text-white' },
];

export function TeeSelector({ onTeeSelected, initialTeeBox }: TeeSelectorProps) {
  const [teeBox, setTeeBox] = useState<TeeBox>(initialTeeBox || {
    name: 'White',
    rating: 72.0,
    slope: 113,
    yardage: 6200
  });
  
  // Handle tee name selection
  const handleSelectTee = (teeName: string) => {
    const newTeeBox = { ...teeBox, name: teeName };
    setTeeBox(newTeeBox);
    onTeeSelected(newTeeBox);
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

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Tee Box
        </label>
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
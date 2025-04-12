// src/components/scorecard/TeeBoxForm.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface TeeBox {
  id?: string;
  name: string;
  color: string;
  rating: number;
  slope: number;
  yardage: number;
}

interface TeeBoxFormProps {
  teeBoxes: TeeBox[];
  onChange: (teeBoxes: TeeBox[]) => void;
}

// Common tee box colors/options
const commonTeeOptions = [
  { name: 'Championship', color: 'black' },
  { name: 'Blue', color: 'blue' },
  { name: 'White', color: 'white' },
  { name: 'Gold', color: 'gold' },
  { name: 'Yellow', color: 'yellow' }, // Added yellow tees
  { name: 'Red', color: 'red' },
  { name: 'Green', color: 'green' },
];

export function TeeBoxForm({ teeBoxes, onChange }: TeeBoxFormProps) {
  // Add a new tee box
  const addTeeBox = () => {
    // Find a tee box option that isn't being used
    const unusedOption = commonTeeOptions.find(option => 
      !teeBoxes.some(teeBox => teeBox.name === option.name)
    );
    
    // Create a new tee box
    const newTeeBox: TeeBox = {
      name: unusedOption ? unusedOption.name : 'Custom',
      color: unusedOption ? unusedOption.color : 'gray',
      rating: 72.0,
      slope: 113,
      yardage: 6200
    };
    
    // Update state
    onChange([...teeBoxes, newTeeBox]);
  };
  
  // Update a tee box
  const updateTeeBox = (index: number, field: keyof TeeBox, value: any) => {
    const updatedTeeBoxes = [...teeBoxes];
    updatedTeeBoxes[index] = {
      ...updatedTeeBoxes[index],
      [field]: value
    };
    onChange(updatedTeeBoxes);
  };
  
  // Remove a tee box
  const removeTeeBox = (index: number) => {
    const updatedTeeBoxes = [...teeBoxes];
    updatedTeeBoxes.splice(index, 1);
    onChange(updatedTeeBoxes);
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-sm">
        <p>Add tee boxes for your golf course. Each tee box should include:</p>
        <ul className="list-disc ml-5 mt-2 text-gray-600 dark:text-gray-400">
          <li>Name/color (e.g., Blue, White, Red)</li>
          <li>Course rating (typically between 65-75)</li>
          <li>Slope rating (typically between 100-155)</li>
          <li>Total yardage</li>
        </ul>
      </div>
      
      {teeBoxes.map((teeBox, index) => (
        <div 
          key={index} 
          className="border border-gray-200 dark:border-gray-700 rounded-md p-4"
        >
          <div className="flex justify-between mb-2">
            <h3 className="font-medium">Tee Set {index + 1}</h3>
            {teeBoxes.length > 1 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => removeTeeBox(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                Remove
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tee Name
              </label>
              <select
                value={teeBox.name}
                onChange={(e) => updateTeeBox(index, 'name', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {commonTeeOptions.map(option => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
                <option value="Custom">Custom</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <select
                value={teeBox.color}
                onChange={(e) => updateTeeBox(index, 'color', e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="black">Black</option>
                <option value="blue">Blue</option>
                <option value="white">White</option>
                <option value="gold">Gold</option>
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="gray">Gray</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Course Rating"
              value={teeBox.rating}
              onChange={(e) => updateTeeBox(index, 'rating', parseFloat(e.target.value))}
              min="60"
              max="80"
              step="0.1"
              helper="Typically 65-75"
            />
            
            <Input
              type="number"
              label="Slope Rating"
              value={teeBox.slope}
              onChange={(e) => updateTeeBox(index, 'slope', parseInt(e.target.value))}
              min="55"
              max="155"
              helper="Typically 100-155"
            />
            
            <Input
              type="number"
              label="Total Yardage"
              value={teeBox.yardage}
              onChange={(e) => updateTeeBox(index, 'yardage', parseInt(e.target.value))}
              min="1000"
              max="8000"
              helper="Total course length"
            />
          </div>
        </div>
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addTeeBox}
        disabled={teeBoxes.length >= 6} // Limit to 6 tee boxes
      >
        + Add Another Tee Set
      </Button>
    </div>
  );
}
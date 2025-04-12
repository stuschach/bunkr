// src/components/scorecard/HoleDataForm.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface HoleData {
  number: number;
  par: number;
}

interface TeeBox {
  id?: string;
  name: string;
  color: string;
  rating: number;
  slope: number;
  yardage: number;
}

interface HoleDataFormProps {
  holeData: HoleData[];
  teeBoxes: TeeBox[];
  onChange: (holeData: HoleData[]) => void;
}

export function HoleDataForm({ holeData, teeBoxes, onChange }: HoleDataFormProps) {
  const [currentPage, setCurrentPage] = useState<'front9' | 'back9'>('front9');
  
  // Calculate front 9 and back 9
  const front9 = holeData.slice(0, 9);
  const back9 = holeData.slice(9, 18);
  
  // Calculate total front 9 and back 9 data
  const front9Par = front9.reduce((sum, hole) => sum + hole.par, 0);
  const back9Par = back9.reduce((sum, hole) => sum + hole.par, 0);
  const totalPar = front9Par + back9Par;
  
  // Update hole data
  const updateHoleField = (holeNumber: number, field: keyof HoleData, value: number) => {
    const updatedHoleData = [...holeData];
    const index = holeNumber - 1;
    
    updatedHoleData[index] = {
      ...updatedHoleData[index],
      [field]: value
    };
    
    onChange(updatedHoleData);
  };
  
  // Set all pars at once for a series of holes
  const setAllPars = (startHole: number, endHole: number, par: number) => {
    const updatedHoleData = [...holeData];
    
    for (let i = startHole - 1; i < endHole; i++) {
      updatedHoleData[i] = {
        ...updatedHoleData[i],
        par
      };
    }
    
    onChange(updatedHoleData);
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-sm">
        <p>Configure the par value for each hole on your course. This will be used to calculate scores.</p>
      </div>
      
      {/* Quick set options */}
      <div className="border rounded-md p-4">
        <h3 className="text-sm font-medium mb-2">Quick Set Options</h3>
        <div className="grid grid-cols-3 gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => setAllPars(1, 18, 4)}
          >
            All Par 4
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Standard course - 4 par 3s, 4 par 5s, rest par 4s
              const updatedHoleData = [...holeData];
              
              // Set all to par 4 first
              for (let i = 0; i < 18; i++) {
                updatedHoleData[i] = {
                  ...updatedHoleData[i],
                  par: 4
                };
              }
              
              // Set par 3s
              [2, 7, 11, 16].forEach(holeNum => {
                updatedHoleData[holeNum - 1] = {
                  ...updatedHoleData[holeNum - 1],
                  par: 3
                };
              });
              
              // Set par 5s
              [4, 9, 13, 18].forEach(holeNum => {
                updatedHoleData[holeNum - 1] = {
                  ...updatedHoleData[holeNum - 1],
                  par: 5
                };
              });
              
              onChange(updatedHoleData);
            }}
          >
            Standard Layout
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Total par 72 distributed evenly
              const updatedHoleData = [...holeData];
              
              // 10 par 4s, 4 par 3s, 4 par 5s = 72 total
              for (let i = 0; i < 18; i++) {
                let par = 4; // Default
                if (i < 4) par = 3; // First 4 holes are par 3
                else if (i >= 14) par = 5; // Last 4 holes are par 5
                
                updatedHoleData[i] = {
                  ...updatedHoleData[i],
                  par
                };
              }
              
              onChange(updatedHoleData);
            }}
          >
            Par 72 Layout
          </Button>
        </div>
      </div>
      
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
      
      {/* Hole data table - SIMPLIFIED */}
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
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {(currentPage === 'front9' ? front9 : back9).map((hole) => (
              <tr key={hole.number}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="font-medium">{hole.number}</span>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <select
                    value={hole.par}
                    onChange={(e) => updateHoleField(hole.number, 'par', parseInt(e.target.value))}
                    className="w-16 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700"
                  >
                    {[3, 4, 5, 6].map((parValue) => (
                      <option key={parValue} value={parValue}>
                        {parValue}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            
            {/* Totals row */}
            <tr className="bg-gray-100 dark:bg-gray-800 font-medium">
              <td className="px-3 py-2 whitespace-nowrap">
                {currentPage === 'front9' ? 'OUT' : 'IN'}
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                {currentPage === 'front9' ? front9Par : back9Par}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Course total */}
      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
        <div className="text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">Course Total</div>
          <div className="text-xl font-bold">Par {totalPar}</div>
        </div>
      </div>
    </div>
  );
}
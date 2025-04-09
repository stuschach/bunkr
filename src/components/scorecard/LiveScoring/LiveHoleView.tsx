// src/components/scorecard/LiveScoring/LiveHoleView.tsx
'use client';

import React from 'react';
import { HoleData } from '@/types/scorecard';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { formatScoreWithRelationToPar } from '@/lib/utils/formatting';

interface LiveHoleViewProps {
  hole: HoleData;
  updateHoleData: (data: Partial<HoleData>) => void;
  isLoading?: boolean;
}

export function LiveHoleView({ hole, updateHoleData, isLoading = false }: LiveHoleViewProps) {
  // Calculate if this is a par 3 (no fairway)
  const isPar3 = hole.par === 3;
  
  // Calculate GIR target (par - 2) putts
  const girTarget = hole.par - 2;
  
  // Get score relative to par as string
  const scoreRelativeToPar = hole.score 
    ? formatScoreWithRelationToPar(hole.score, hole.par).split(' ')[1]
    : '';
  
  // Determine score color based on relation to par
  const getScoreColor = () => {
    if (!hole.score) return '';
    
    const diff = hole.score - hole.par;
    if (diff < 0) return 'text-green-500';
    if (diff === 0) return 'text-gray-700 dark:text-gray-300';
    if (diff === 1) return 'text-red-500';
    return 'text-red-600';
  };

  // Handle fairway toggle
  const handleFairwayToggle = (hit: boolean) => {
    updateHoleData({ fairwayHit: hit });
  };
  
  // Handle GIR toggle
  const handleGIRToggle = (hit: boolean) => {
    updateHoleData({ greenInRegulation: hit });
  };
  
  // Handle putts change
  const handlePuttsChange = (putts: number) => {
    updateHoleData({ putts });
  };
  
  // Handle penalties change
  const handlePenaltiesChange = (penalties: number) => {
    updateHoleData({ penalties });
  };

  return (
    <div className="space-y-6">
      {/* Hole header with par and score */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Hole {hole.number}</h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Par {hole.par}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">Score</div>
          <div className={`text-3xl font-bold ${getScoreColor()}`}>
            {hole.score || '-'}
            {scoreRelativeToPar && (
              <span className="ml-2 text-lg">{scoreRelativeToPar}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Stats tracking */}
      <div className="space-y-4">
        {/* Fairway hit (not for par 3s) */}
        {!isPar3 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fairway Hit
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={hole.fairwayHit === true ? 'primary' : 'outline'}
                onClick={() => handleFairwayToggle(true)}
                disabled={isLoading}
              >
                Hit ✓
              </Button>
              <Button
                type="button"
                variant={hole.fairwayHit === false ? 'primary' : 'outline'}
                onClick={() => handleFairwayToggle(false)}
                disabled={isLoading}
              >
                Missed ✗
              </Button>
            </div>
          </div>
        )}
        
        {/* Green in regulation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Green in Regulation
            <span className="ml-1 text-xs text-gray-500">
              ({girTarget} or fewer strokes to green)
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={hole.greenInRegulation ? 'primary' : 'outline'}
              onClick={() => handleGIRToggle(true)}
              disabled={isLoading}
            >
              Hit ✓
            </Button>
            <Button
              type="button"
              variant={hole.greenInRegulation === false ? 'primary' : 'outline'}
              onClick={() => handleGIRToggle(false)}
              disabled={isLoading}
            >
              Missed ✗
            </Button>
          </div>
        </div>
        
        {/* Putts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Putts
          </label>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map(putts => (
              <Button
                key={putts}
                type="button"
                variant={hole.putts === putts ? 'primary' : 'outline'}
                onClick={() => handlePuttsChange(putts)}
                disabled={isLoading}
                className="flex-1 min-w-[50px]"
              >
                {putts}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Penalties */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Penalty Strokes
          </label>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map(penalties => (
              <Button
                key={penalties}
                type="button"
                variant={hole.penalties === penalties ? 'primary' : 'outline'}
                onClick={() => handlePenaltiesChange(penalties)}
                disabled={isLoading}
                className="flex-1 min-w-[50px]"
              >
                {penalties}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Notes input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notes
        </label>
        <textarea
          value={hole.notes || ''}
          onChange={(e) => updateHoleData({ notes: e.target.value })}
          placeholder="Record memorable shots, club selection, etc..."
          className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-100"
          rows={2}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
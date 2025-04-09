// src/components/tee-times/TeeTimeFilters.tsx
'use client';

import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/Calendar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { TeeTimeFilters } from '@/types/tee-times';

interface TeeTimeFiltersProps {
  onFilterChange: (filters: TeeTimeFilters) => void;
  initialFilters?: TeeTimeFilters;
}

export function TeeTimeFiltersComponent({ 
  onFilterChange, 
  initialFilters 
}: TeeTimeFiltersProps) {
  const [filters, setFilters] = useState<TeeTimeFilters>(initialFilters || {
    status: 'open',
    date: null,
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const handleStatusChange = (value: string) => {
    const newFilters = {
      ...filters,
      status: value as 'all' | 'open' | 'full' | 'cancelled'
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const handleDateSelect = (date: Date | null) => {
    const newFilters = {
      ...filters,
      date
    };
    setFilters(newFilters);
    setShowDatePicker(false);
    onFilterChange(newFilters);
  };
  
  const handleClearDate = () => {
    const newFilters = {
      ...filters,
      date: null
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const handleMaxDistanceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const maxDistance = e.target.value === 'any' ? undefined : parseInt(e.target.value);
    const newFilters = {
      ...filters,
      maxDistance
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const predefinedDates = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'This Weekend', date: addDays(new Date(), (6 - new Date().getDay()) % 7) },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          {/* Status filter */}
          <div className="w-full md:w-auto">
            <Select
              options={[
                { value: 'all', label: 'All Tee Times' },
                { value: 'open', label: 'Open Tee Times' },
                { value: 'full', label: 'Full Tee Times' },
              ]}
              value={filters.status || 'all'}
              onChange={handleStatusChange}
            />
          </div>
          
          {/* Date filter */}
          <div className="relative w-full md:w-auto">
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Input
                placeholder="Select date"
                value={filters.date ? format(filters.date, 'MMM d, yyyy') : ''}
                readOnly
                rightIcon={
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
              
              {filters.date && (
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearDate();
                  }}
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {showDatePicker && (
              <div className="absolute z-10 mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg">
                <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex space-x-2">
                  {predefinedDates.map((preset) => (
                    <Badge
                      key={preset.label}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => handleDateSelect(preset.date)}
                    >
                      {preset.label}
                    </Badge>
                  ))}
                </div>
                <Calendar
                  value={filters.date || undefined}
                  onChange={handleDateSelect}
                  minDate={new Date()}
                />
              </div>
            )}
          </div>
          
          {/* Distance filter */}
          <div className="w-full md:w-auto">
            <Select
              options={[
                { value: 'any', label: 'Any Distance' },
                { value: '10', label: 'Within 10 miles' },
                { value: '25', label: 'Within 25 miles' },
                { value: '50', label: 'Within 50 miles' },
                { value: '100', label: 'Within 100 miles' },
              ]}
              value={filters.maxDistance?.toString() || 'any'}
              onChange={handleMaxDistanceChange}
            />
          </div>
        </div>
        
        {/* Active filters */}
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.status && filters.status !== 'all' && (
            <Badge variant="outline" className="flex items-center space-x-1">
              <span>Status: {filters.status}</span>
              <button
                onClick={() => handleStatusChange('all')}
                className="ml-1"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Badge>
          )}
          
          {filters.date && (
            <Badge variant="outline" className="flex items-center space-x-1">
              <span>Date: {format(filters.date, 'MMM d, yyyy')}</span>
              <button
                onClick={handleClearDate}
                className="ml-1"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Badge>
          )}
          
          {filters.maxDistance && (
            <Badge variant="outline" className="flex items-center space-x-1">
              <span>Distance: Within {filters.maxDistance} miles</span>
              <button
                onClick={() => handleMaxDistanceChange({ target: { value: 'any' } } as React.ChangeEvent<HTMLSelectElement>)}
                className="ml-1"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
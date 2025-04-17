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
import { 
  CalendarIcon, 
  MapPinIcon, 
  FilterIcon, 
  XIcon, 
  ChevronDownIcon, 
  SearchIcon,
  InfoIcon,
  MailIcon
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface TeeTimeFiltersProps {
  onFilterChange: (filters: TeeTimeFilters) => void;
  initialFilters?: TeeTimeFilters;
  showInvitedFilter?: boolean;
}

export function TeeTimeFiltersComponent({ 
  onFilterChange, 
  initialFilters,
  showInvitedFilter = false
}: TeeTimeFiltersProps) {
  const [filters, setFilters] = useState<TeeTimeFilters>(initialFilters || {
    status: 'open',
    date: null,
    showInvitedOnly: false
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
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
  
  const handleToggleInvitedOnly = () => {
    const newFilters = {
      ...filters,
      showInvitedOnly: !filters.showInvitedOnly
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const handleClearFilters = () => {
    const newFilters = {
      status: 'all',
      date: null,
      maxDistance: undefined,
      showInvitedOnly: false
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const predefinedDates = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'This Weekend', date: addDays(new Date(), (6 - new Date().getDay()) % 7) },
  ];
  
  const hasActiveFilters = 
    (filters.status && filters.status !== 'all') || 
    filters.date !== null || 
    filters.maxDistance !== undefined ||
    filters.showInvitedOnly;

  return (
    <Card className="mb-6 border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-all duration-300">
      <CardContent className="p-0">
        {/* Filter header - always visible */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center">
            <FilterIcon className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="font-medium text-gray-800 dark:text-gray-200">Filter Tee Times</h3>
            {hasActiveFilters && (
              <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {Object.values(filters).filter(v => v !== null && v !== undefined && v !== 'all' && v !== false).length}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XIcon className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ChevronDownIcon className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filter panel - expandable */}
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <Select
                  options={[
                    { value: 'all', label: 'All Tee Times' },
                    { value: 'open', label: 'Open Tee Times' },
                    { value: 'full', label: 'Full Tee Times' },
                  ]}
                  value={filters.status || 'all'}
                  onChange={handleStatusChange}
                  className="w-full rounded-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>
              
              {/* Date filter */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                >
                  <Input
                    placeholder="Any date"
                    value={filters.date ? format(filters.date, 'MMM d, yyyy') : ''}
                    readOnly
                    className="rounded-full pr-10"
                    rightIcon={
                      <CalendarIcon className="h-5 w-5 text-gray-400" />
                    }
                  />
                  
                  {filters.date && (
                    <button
                      type="button"
                      className="absolute right-10 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDate();
                      }}
                    >
                      <XIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
                
                {showDatePicker && (
                  <div className="absolute z-10 mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex flex-wrap gap-2">
                      {predefinedDates.map((preset) => (
                        <Badge
                          key={preset.label}
                          variant="outline"
                          className="cursor-pointer hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
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
                      className="rounded-b-lg border-t-0"
                    />
                  </div>
                )}
              </div>
              
              {/* Distance filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Distance
                </label>
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
                  className="w-full rounded-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>
              
              {/* Invitations only filter */}
              {showInvitedFilter && (
                <div className="md:col-span-3 mt-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="invited-only-toggle"
                      checked={filters.showInvitedOnly || false}
                      onChange={handleToggleInvitedOnly}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label 
                      htmlFor="invited-only-toggle" 
                      className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex items-center"
                    >
                      <MailIcon className="w-4 h-4 mr-1.5 text-amber-500" />
                      Show only tee times I've been invited to
                      <Tooltip content="Filter to only show tee times where you have a pending invitation">
                        <InfoIcon className="w-4 h-4 ml-2 text-gray-500 cursor-help" />
                      </Tooltip>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Active filters - shown when filters are not expanded */}
        {!isExpanded && hasActiveFilters && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap gap-2">
              {filters.status && filters.status !== 'all' && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center px-3 py-1.5 rounded-full">
                  <span>Status: {filters.status}</span>
                  <button
                    onClick={() => handleStatusChange('all')}
                    className="ml-1 p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filters.date && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center px-3 py-1.5 rounded-full">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  <span>{format(filters.date, 'MMM d, yyyy')}</span>
                  <button
                    onClick={handleClearDate}
                    className="ml-1 p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filters.maxDistance && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center px-3 py-1.5 rounded-full">
                  <MapPinIcon className="h-3 w-3 mr-1" />
                  <span>Within {filters.maxDistance} miles</span>
                  <button
                    onClick={() => handleMaxDistanceChange({ target: { value: 'any' } } as React.ChangeEvent<HTMLSelectElement>)}
                    className="ml-1 p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filters.showInvitedOnly && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center px-3 py-1.5 rounded-full">
                  <MailIcon className="h-3 w-3 mr-1" />
                  <span>Invitations Only</span>
                  <button
                    onClick={handleToggleInvitedOnly}
                    className="ml-1 p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
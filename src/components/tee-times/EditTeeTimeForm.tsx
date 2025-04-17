// src/components/tee-times/EditTeeTimeForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Heading, Text } from '@/components/ui/Typography';
import { RadioGroup } from '@/components/ui/Radio';
import { TeeTime, TeeTimeFormData, TeeTimeVisibility } from '@/types/tee-times';
import { useTeeTime } from '@/lib/hooks/useTeeTime';
import { useToast } from '@/lib/hooks/useToast';

interface EditTeeTimeFormProps {
  teeTime: TeeTime;
  onSave: () => void;
  onCancel: () => void;
}

export function EditTeeTimeForm({ teeTime, onSave, onCancel }: EditTeeTimeFormProps) {
  const { updateTeeTime, isLoading, pendingOperations } = useTeeTime();
  const { showToast } = useToast();
  
  // Parse the date and time from teeTime
  const teeTimeDate = teeTime.dateTime ? new Date(teeTime.dateTime) : new Date();
  const teeTimeHours = teeTimeDate.getHours().toString().padStart(2, '0');
  const teeTimeMinutes = teeTimeDate.getMinutes().toString().padStart(2, '0');
  const teeTimeTimeString = `${teeTimeHours}:${teeTimeMinutes}`;
  
  // Form state
  const [formData, setFormData] = useState<TeeTimeFormData>({
    courseName: teeTime.courseName || '',
    courseId: teeTime.courseId || '',
    date: teeTimeDate,
    time: teeTimeTimeString,
    maxPlayers: teeTime.maxPlayers || 4,
    visibility: teeTime.visibility || 'public',
    description: teeTime.description || '',
  });
  
  const [errors, setErrors] = useState<{
    [key: string]: string;
  }>({});
  
  // Show date picker toggle
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Check if update is in progress
  const isUpdating = isLoading || pendingOperations[`update_${teeTime.id}`];
  
  // Update form data when teeTime changes
  useEffect(() => {
    setFormData({
      courseName: teeTime.courseName || '',
      courseId: teeTime.courseId || '',
      date: teeTimeDate,
      time: teeTimeTimeString,
      maxPlayers: teeTime.maxPlayers || 4,
      visibility: teeTime.visibility || 'public',
      description: teeTime.description || '',
    });
  }, [teeTime, teeTimeDate, teeTimeTimeString]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxPlayers' ? parseInt(value) : value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const handleDateSelect = (date: Date) => {
    setFormData(prev => ({
      ...prev,
      date
    }));
    setShowDatePicker(false);
    
    if (errors.date) {
      setErrors(prev => ({
        ...prev,
        date: ''
      }));
    }
  };
  
  const handleVisibilityChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      visibility: value as TeeTimeVisibility
    }));
  };
  
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.courseName.trim()) {
      newErrors.courseName = 'Course name is required';
    }
    
    if (!formData.time) {
      newErrors.time = 'Time is required';
    }
    
    // Ensure date is today or in the future
    const selectedDate = new Date(formData.date);
    const todayWithoutTime = new Date();
    todayWithoutTime.setHours(0, 0, 0, 0);
    
    if (selectedDate < todayWithoutTime) {
      newErrors.date = 'Date must be today or in the future';
    }
    
    // Special validation for max players
    // Cannot reduce below current player count
    if (formData.maxPlayers < (teeTime.currentPlayers || 1)) {
      newErrors.maxPlayers = `Cannot set group size below current player count (${teeTime.currentPlayers})`;
    }
    
    // Check if max players is between 2 and 8
    if (formData.maxPlayers < 2 || formData.maxPlayers > 8) {
      newErrors.maxPlayers = 'Group size must be between 2 and 8 players';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // Update the tee time
      const success = await updateTeeTime(teeTime.id, formData);
      
      if (success) {
        showToast?.({
          title: 'Success',
          description: 'Tee time has been updated',
          variant: 'success'
        });
        
        onSave();
      }
    } catch (error) {
      console.error('Error updating tee time:', error);
      
      showToast?.({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update tee time',
        variant: 'error'
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Course Name"
          name="courseName"
          value={formData.courseName}
          onChange={handleInputChange}
          error={errors.courseName}
          required
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Date"
              name="date"
              value={format(formData.date, 'MM/dd/yyyy')}
              onClick={() => setShowDatePicker(!showDatePicker)}
              readOnly
              error={errors.date}
              rightIcon={
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            
            {showDatePicker && (
              <div className="relative z-10 mt-1">
                <div className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date: Date) => date && handleDateSelect(date)}
                    minDate={new Date()}
                  />
                </div>
              </div>
            )}
          </div>
          
          <Input
            label="Time"
            name="time"
            type="time"
            value={formData.time}
            onChange={handleInputChange}
            error={errors.time}
            required
          />
        </div>
        
        <Input
          label="Group Size"
          name="maxPlayers"
          type="number"
          min={Math.max(2, teeTime.currentPlayers || 1)}
          max={8}
          value={formData.maxPlayers.toString()}
          onChange={handleInputChange}
          error={errors.maxPlayers}
          helper={`Maximum number of players including yourself (${Math.max(2, teeTime.currentPlayers || 1)}-8)`}
        />
        
        <div>
          <Text className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Visibility
          </Text>
          <RadioGroup
            name="visibility"
            options={[
              { value: 'public', label: 'Public - Anyone can see and request to join' },
              { value: 'followers', label: 'Followers Only - Only your followers can see and join' },
              { value: 'private', label: 'Private - Only visible to people you invite' }
            ]}
            value={formData.visibility}
            onChange={handleVisibilityChange}
          />
        </div>
        
        <div>
          <Text className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Description (Optional)
          </Text>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:text-gray-100"
            placeholder="Add any additional details like skill level, pace of play, or special arrangements..."
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isUpdating}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isUpdating}
          disabled={isUpdating}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
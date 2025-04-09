// src/components/tee-times/TeeTimeForm.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Heading, Text } from '@/components/ui/Typography';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { RadioGroup } from '@/components/ui/Radio';
import { TeeTimeFormData, TeeTimeVisibility } from '@/types/tee-times';

interface TeeTimeFormProps {
  initialData?: Partial<TeeTimeFormData>;
  onSubmit: (data: TeeTimeFormData) => Promise<void>;
  isSubmitting?: boolean;
  isEditing?: boolean;
}

export function TeeTimeForm({ 
  initialData, 
  onSubmit, 
  isSubmitting = false,
  isEditing = false 
}: TeeTimeFormProps) {
  const router = useRouter();
  const today = new Date();
  
  // Form state
  const [formData, setFormData] = useState<TeeTimeFormData>({
    courseName: initialData?.courseName || '',
    courseId: initialData?.courseId || '',
    date: initialData?.date || today,
    time: initialData?.time || '08:00',
    maxPlayers: initialData?.maxPlayers || 4,
    visibility: initialData?.visibility || 'public',
    description: initialData?.description || '',
  });
  
  const [errors, setErrors] = useState<{
    [key: string]: string;
  }>({});
  
  // Show date picker toggle
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      await onSubmit(formData);
      
      if (!isEditing) {
        router.push('/tee-times');
      }
    } catch (error) {
      console.error('Error submitting tee time:', error);
    }
  };
  
  const handleCancel = () => {
    router.back();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          <Heading level={3}>
            {isEditing ? 'Edit Tee Time' : 'Create Group Tee Time'}
          </Heading>
          
          <div className="space-y-4">
            <Input
              label="Course Name"
              name="courseName"
              value={formData.courseName}
              onChange={handleInputChange}
              error={errors.courseName}
              placeholder="Enter golf course name"
              required
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Calendar
                      value={formData.date}
                      onChange={handleDateSelect}
                      minDate={today}
                    />
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
              min={2}
              max={8}
              value={formData.maxPlayers.toString()}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  maxPlayers: parseInt(e.target.value) || 4
                }));
                
                if (errors.maxPlayers) {
                  setErrors(prev => ({
                    ...prev,
                    maxPlayers: ''
                  }));
                }
              }}
              error={errors.maxPlayers}
              helper="Maximum number of players including yourself (2-8)"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Visibility
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:text-gray-100"
                placeholder="Add any additional details like skill level, pace of play, or special arrangements..."
              />
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-4 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Update Tee Time' : 'Create Tee Time'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
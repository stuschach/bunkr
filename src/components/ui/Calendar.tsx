// src/components/ui/Calendar.tsx
import React, { useState } from 'react';
import { cn } from '@/lib/utils/cn';

// Helper functions
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const getMonthName = (month: number) => {
  return new Date(0, month).toLocaleString('default', { month: 'long' });
};

// DatePicker props
export interface CalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  disabled?: boolean;
}

export const Calendar = ({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  disabled = false,
}: CalendarProps) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(value?.getMonth() || today.getMonth());
  const [currentYear, setCurrentYear] = useState(value?.getFullYear() || today.getFullYear());
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  // Navigation
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Date selection
  const handleDateClick = (day: number) => {
    if (disabled) return;
    
    const selectedDate = new Date(currentYear, currentMonth, day);
    
    // Check if the date is within range
    if (minDate && selectedDate < minDate) return;
    if (maxDate && selectedDate > maxDate) return;
    
    if (onChange) {
      onChange(selectedDate);
    }
  };

  // Rendering helpers
  const isToday = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    
    const date = new Date(currentYear, currentMonth, day);
    return (
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear()
    );
  };

  const isDisabled = (day: number) => {
    if (disabled) return true;
    
    const date = new Date(currentYear, currentMonth, day);
    
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    
    return false;
  };

  // Build the calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const days = [];
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Empty cells for the days before the 1st of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        disabled={isDisabled(day)}
        onFocus={() => setFocusedDate(new Date(currentYear, currentMonth, day))}
        onBlur={() => setFocusedDate(null)}
        className={cn(
          "h-8 w-8 rounded-full text-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-fairway focus:ring-offset-2 dark:focus:ring-offset-gray-950",
          {
            "bg-green-fairway text-white": isSelected(day),
            "text-green-fairway font-bold": isToday(day) && !isSelected(day),
            "hover:bg-gray-100 dark:hover:bg-gray-800": !isSelected(day) && !isDisabled(day),
            "text-gray-400 dark:text-gray-600 cursor-not-allowed": isDisabled(day),
          }
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "p-4 bg-white dark:bg-gray-900 shadow-md rounded-md border border-gray-200 dark:border-gray-800",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          disabled={disabled || (minDate && new Date(currentYear, currentMonth, 0) < minDate)}
          className={cn(
            "p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800",
            "focus:outline-none focus:ring-2 focus:ring-green-fairway focus:ring-offset-2 dark:focus:ring-offset-gray-950",
            {
              "text-gray-400 dark:text-gray-600 cursor-not-allowed": disabled || (minDate && new Date(currentYear, currentMonth, 0) < minDate)
            }
          )}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="font-medium">
          {getMonthName(currentMonth)} {currentYear}
        </div>
        
        <button
          onClick={goToNextMonth}
          disabled={disabled || (maxDate && new Date(currentYear, currentMonth + 1, 1) > maxDate)}
          className={cn(
            "p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800",
            "focus:outline-none focus:ring-2 focus:ring-green-fairway focus:ring-offset-2 dark:focus:ring-offset-gray-950",
            {
              "text-gray-400 dark:text-gray-600 cursor-not-allowed": disabled || (maxDate && new Date(currentYear, currentMonth + 1, 1) > maxDate)
            }
          )}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day) => (
          <div key={day} className="h-8 w-8 text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      
      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>
    </div>
  );
};
// src/lib/utils/date-format.ts
/**
 * Date formatting utility functions for consistent date display throughout the app
 */

// Format a date to a short display format (e.g., "Jan 15, 2025")
export const formatShortDate = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj);
  };
  
  // Format a date to display with time (e.g., "Jan 15, 2025, 2:30 PM")
  export const formatDateWithTime = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(dateObj);
  };
  
  // Format a date to display day of week (e.g., "Monday, Jan 15")
  export const formatDayOfWeek = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  };
  
  // Get a relative time string (e.g., "2 hours ago", "yesterday", "5 days ago")
  export const getRelativeTimeString = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const now = new Date();
    
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
    // Less than a minute
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    // Less than an hour
    if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    }
    
    // Less than a day
    if (diffInSeconds < 86400) {
      return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    }
    
    // Less than a week
    if (diffInSeconds < 604800) {
      return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    }
    
    // Less than a month
    if (diffInSeconds < 2629800) {
      return rtf.format(-Math.floor(diffInSeconds / 604800), 'week');
    }
    
    // Less than a year
    if (diffInSeconds < 31557600) {
      return rtf.format(-Math.floor(diffInSeconds / 2629800), 'month');
    }
    
    // Over a year
    return rtf.format(-Math.floor(diffInSeconds / 31557600), 'year');
  };
  
  // Format date for use in scorecards (e.g., "Mon, Jan 15")
  export const formatScorecardDate = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  };
  
  // Get time in 12-hour format (e.g., "2:30 PM")
  export const formatTime = (date: Date | string | number): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(dateObj);
  };
  
  // Format a date range (e.g., "Jan 15 - Jan 20, 2025")
  export const formatDateRange = (
    startDate: Date | string | number,
    endDate: Date | string | number
  ): string => {
    const startObj = typeof startDate === 'string' || typeof startDate === 'number' 
      ? new Date(startDate) 
      : startDate;
    const endObj = typeof endDate === 'string' || typeof endDate === 'number' 
      ? new Date(endDate) 
      : endDate;
    
    // If in the same month and year
    if (startObj.getMonth() === endObj.getMonth() && startObj.getFullYear() === endObj.getFullYear()) {
      return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(startObj)} - ${
        new Intl.DateTimeFormat('en-US', { day: 'numeric', year: 'numeric' }).format(endObj)
      }`;
    }
    
    // If in the same year
    if (startObj.getFullYear() === endObj.getFullYear()) {
      return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(startObj)} - ${
        new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(endObj)
      }`;
    }
    
    // Different years
    return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(startObj)} - ${
      new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(endObj)
    }`;
  };
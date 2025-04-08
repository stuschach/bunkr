// src/lib/utils/validation.ts
/**
 * Validation utility functions for form fields and data
 */

// Email validation
export const isValidEmail = (email: string): boolean => {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
  };
  
  // Password validation - minimum 8 chars, at least 1 letter and 1 number
  export const isValidPassword = (password: string): boolean => {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  };
  
  // Username validation - alphanumeric with underscores, 3-20 chars
  export const isValidUsername = (username: string): boolean => {
    const pattern = /^[a-zA-Z0-9_]{3,20}$/;
    return pattern.test(username);
  };
  
  // Validate a URL
  export const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  // Phone number validation (US format) - FIXED
  export const isValidPhone = (phone: string): boolean => {
    const pattern = /^(\+1|1)?[-.\s]?(\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}$/;
    return pattern.test(phone);
  };
  
  // Validate golf score (between 30 and 200)
  export const isValidGolfScore = (score: number): boolean => {
    return !isNaN(score) && score >= 30 && score <= 200;
  };
  
  // Validate hole score (between 1 and 15)
  export const isValidHoleScore = (score: number): boolean => {
    return !isNaN(score) && score >= 1 && score <= 15;
  };
  
  // Validate handicap index (between +5 and 54)
  export const isValidHandicapIndex = (handicap: number): boolean => {
    return !isNaN(handicap) && handicap >= -5 && handicap <= 54;
  };
  
  // Validate course slope (between 55 and 155)
  export const isValidCourseSlope = (slope: number): boolean => {
    return !isNaN(slope) && slope >= 55 && slope <= 155;
  };
  
  // Validate course rating (between 60 and 80)
  export const isValidCourseRating = (rating: number): boolean => {
    return !isNaN(rating) && rating >= 60 && rating <= 80;
  };
  
  // Check if a string contains only numbers
  export const isNumeric = (value: string): boolean => {
    return /^-?\d+$/.test(value);
  };
  
  // Check if a string contains only letters
  export const isAlpha = (value: string): boolean => {
    return /^[a-zA-Z]+$/.test(value);
  };
  
  // Check if a string contains only letters and numbers
  export const isAlphanumeric = (value: string): boolean => {
    return /^[a-zA-Z0-9]+$/.test(value);
  };
  
  // Validate zip code (US format)
  export const isValidZipCode = (zipCode: string): boolean => {
    return /^\d{5}(-\d{4})?$/.test(zipCode);
  };
  
  // Validate a date string is in YYYY-MM-DD format
  export const isValidDateFormat = (dateString: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  };
  
  // Check if a date string is a valid date
  export const isValidDate = (dateString: string): boolean => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };
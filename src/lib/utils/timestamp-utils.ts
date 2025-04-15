/**
 * Utilities for safely handling Firestore timestamps and conversions
 */
import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts any timestamp-like object to a JavaScript Date
 * Handles Firebase Timestamps, plain objects with seconds/nanoseconds,
 * Date objects, and numbers (milliseconds since epoch)
 */
export function safeTimestampToDate(timestamp: any): Date | null {
  if (!timestamp) {
    return null;
  }
  
  try {
    // If it's a Firebase Timestamp with toDate method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's already a JavaScript Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a timestamp with seconds and nanoseconds (Firestore timestamp-like object)
    if (timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
      return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
    }
    
    // If it's a number (milliseconds since epoch)
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    // Fallback - return current date as last resort
    console.warn('Unknown timestamp format:', timestamp);
    return null;
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return null;
  }
}

/**
 * Safely converts any timestamp-like object to a Firestore Timestamp
 * Useful when you need to ensure a value is a proper Firestore Timestamp
 */
export function safeToFirestoreTimestamp(timestamp: any): Timestamp {
  if (!timestamp) {
    return Timestamp.now();
  }
  
  try {
    // If it's already a Firestore Timestamp
    if (timestamp instanceof Timestamp) {
      return timestamp;
    }
    
    // If it's a timestamp with seconds and nanoseconds
    if (timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds);
    }
    
    // If it's a JavaScript Date
    if (timestamp instanceof Date) {
      return Timestamp.fromDate(timestamp);
    }
    
    // If it's a number (milliseconds since epoch)
    if (typeof timestamp === 'number') {
      return Timestamp.fromMillis(timestamp);
    }
    
    // Fallback
    return Timestamp.now();
  } catch (error) {
    console.error('Error converting to Firestore timestamp:', error);
    return Timestamp.now();
  }
}

/**
 * Check if a value is a valid timestamp-like object that can be converted to a Date
 */
export function isValidTimestamp(value: any): boolean {
  if (!value) {
    return false;
  }
  
  return (
    // Has a toDate method
    (typeof value.toDate === 'function') ||
    // Is a JavaScript Date
    (value instanceof Date) ||
    // Has seconds and nanoseconds like a Firestore timestamp
    (value.seconds !== undefined && value.nanoseconds !== undefined) ||
    // Is a number representing milliseconds
    (typeof value === 'number')
  );
}
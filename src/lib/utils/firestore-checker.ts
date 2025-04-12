// src/lib/utils/firestore-checker.ts

import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function checkRequiredIndexes() {
  try {
    // Test a compound query to see if indexes are properly set up
    const testQuery = query(
      collection(db, 'scorecards'),
      where('userId', '==', 'test'),
      orderBy('date', 'desc')
    );
    
    await getDocs(testQuery);
    console.log('Firestore indexes appear to be correctly configured');
    return true;
  } catch (error: any) {
    if (error.code === 'failed-precondition') {
      console.error('Firestore indexes not properly configured:', error.message);
      // Extract the suggested index creation URL if available
      const match = error.message.match(/(https:\/\/console\.firebase\.google\.com\/[^\s]+)/);
      if (match && match[1]) {
        console.error('Create the required index at:', match[1]);
      }
      return false;
    }
    console.error('Error checking indexes:', error);
    return false;
  }
}
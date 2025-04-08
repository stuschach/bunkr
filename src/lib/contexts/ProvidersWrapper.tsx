// src/lib/contexts/ProvidersWrapper.tsx
'use client';

import React, { useEffect } from 'react';
import { ApiProviders } from '@/lib/api/providers';
import { useStore } from '@/store';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';

export const ProvidersWrapper: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const { setUser, setAuthStatus } = useStore(state => ({
    setUser: state.setUser,
    setAuthStatus: state.setAuthStatus
  }));

  // Handle authentication state changes
  useEffect(() => {
    setAuthStatus('loading');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            // User exists in Firestore
            const userData = userDoc.data() as Omit<UserProfile, 'uid'>;
            // Use nullish coalescing operator for cleaner code
            const userProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? null,
              displayName: firebaseUser.displayName ?? null,
              photoURL: firebaseUser.photoURL ?? null,
              ...userData
            };
            setUser(userProfile);
          } else {
            // User exists in Auth but not in Firestore
            const userProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? null,
              displayName: firebaseUser.displayName ?? null,
              photoURL: firebaseUser.photoURL ?? null,
              createdAt: new Date(),
              handicapIndex: null,
              homeCourse: null,
              profileComplete: false,
            };
            setUser(userProfile);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        // User is signed out
        setUser(null);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [setUser, setAuthStatus]);

  // Apply theme based on store settings
  useEffect(() => {
    const theme = useStore.getState().theme;
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const setIsOnline = useStore.getState().setIsOnline;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ApiProviders>
      {children}
    </ApiProviders>
  );
};
// src/lib/contexts/ProvidersWrapper.tsx
'use client';

import React, { useEffect } from 'react';
import { ApiProviders } from '@/lib/api/providers';
import { useStore } from '@/store'; // Make sure this import matches your file structure
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/auth';
import { AuthProvider } from './AuthContext';
import { NotificationProvider } from './NotificationContext';
import { SnackbarProvider } from '@/components/common/feedback/Snackbar';

export const ProvidersWrapper: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  // Get actions directly from the store without using a selector
  const setUser = useStore(state => state.setUser);
  const setAuthStatus = useStore(state => state.setAuthStatus);
  const setUnreadMessageCount = useStore(state => state.setUnreadMessageCount);

  // Get theme from store - this makes the component react to theme changes
  const theme = useStore(state => state.theme);

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
            
            // Get unread message count
            await updateUnreadMessageCount(firebaseUser.uid);
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
          
          setAuthStatus('authenticated');
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
          setAuthStatus('unauthenticated');
        }
      } else {
        // User is signed out
        setUser(null);
        setAuthStatus('unauthenticated');
        setUnreadMessageCount(0);
      }
    });

    // Function to update unread message count
    const updateUnreadMessageCount = async (userId: string) => {
      try {
        // Find chats where the user is a participant
        const chatsQuery = query(
          collection(db, 'messages'),
          where(`participants.${userId}`, '==', true)
        );
        
        const chatsSnapshot = await getDocs(chatsQuery);
        let totalUnread = 0;
        
        // For each chat, check for unread messages
        await Promise.all(chatsSnapshot.docs.map(async (chatDoc) => {
          // Get messages from this chat that are not from the current user
          const messagesQuery = query(
            collection(db, 'messages', chatDoc.id, 'thread'),
            where('senderId', '!=', userId)
          );
          
          const messagesSnapshot = await getDocs(messagesQuery);
          
          // Count messages that don't have readBy for the current user
          messagesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!data.readBy || !data.readBy[userId]) {
              totalUnread++;
            }
          });
        }));
        
        setUnreadMessageCount(totalUnread);
      } catch (error) {
        console.error("Error counting unread messages:", error);
      }
    };

    // Cleanup subscription
    return () => unsubscribe();
  }, [setUser, setAuthStatus, setUnreadMessageCount]);

  // Apply theme based on store settings - UPDATED to react to theme changes
  useEffect(() => {
    // Get the document element
    const root = document.documentElement;
    
    // Remove both classes to start fresh
    root.classList.remove('light', 'dark');
    
    // Apply the right theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.add('light');
    } else {
      // For 'system', check user preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
      
      // Set up media query listener for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]); // Now this effect runs whenever theme changes

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
    <AuthProvider>
      <NotificationProvider>
        <SnackbarProvider>
          <ApiProviders>
            {children}
          </ApiProviders>
        </SnackbarProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};
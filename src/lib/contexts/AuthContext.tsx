import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { 
  signIn, 
  registerUser, 
  signInWithGoogle,
  signOut, 
  resetPassword,
  onAuthStateChange
} from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { 
  AuthContextType, 
  UserProfile, 
  LoginCredentials, 
  RegistrationData 
} from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChange(async (firebaseUser: User | null) => {
      if (firebaseUser) {
        // User is signed in, get their profile from Firestore
        const docRef = doc(db, 'users', firebaseUser.uid);
        
        // Set up listener for user document
        const unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ 
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              ...docSnap.data()
            } as UserProfile);
          } else {
            // User document doesn't exist yet, use basic Firebase user info
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              createdAt: new Date(),
              handicapIndex: null,
              homeCourse: null,
              profileComplete: false,
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user document:", error);
          setError("Failed to load user profile");
          setLoading(false);
        });
        
        return () => unsubscribeDoc();
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen for unread messages count
  useEffect(() => {
    if (!user) {
      setUnreadMessageCount(0);
      return () => {};
    }

    // Find chats where the current user is a participant
    const chatsQuery = query(
      collection(db, 'messages'),
      where(`participants.${user.uid}`, '==', true)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (chatsSnapshot) => {
      let totalUnread = 0;

      // For each chat, check for unread messages
      const unreadPromises = chatsSnapshot.docs.map(async (chatDoc) => {
        // Get messages from this chat that are not from the current user and not read
        const messagesQuery = query(
          collection(db, 'messages', chatDoc.id, 'thread'),
          where('senderId', '!=', user.uid)
        );

        try {
          const messagesSnapshot = await getDocs(messagesQuery);
          
          // Count messages that don't have readBy for the current user
          const unreadCount = messagesSnapshot.docs.reduce((count, doc) => {
            const data = doc.data();
            // If readBy doesn't exist or current user hasn't read it
            if (!data.readBy || !data.readBy[user.uid]) {
              return count + 1;
            }
            return count;
          }, 0);
          
          return unreadCount;
        } catch (err) {
          console.error('Error counting unread messages:', err);
          return 0;
        }
      });

      // Sum up all unread messages
      const unreadCounts = await Promise.all(unreadPromises);
      totalUnread = unreadCounts.reduce((total, count) => total + count, 0);

      setUnreadMessageCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setError(null);
      setLoading(true);
      await signIn(credentials.email, credentials.password);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegistrationData) => {
    try {
      setError(null);
      setLoading(true);
      await registerUser(data.email, data.password, data.displayName);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut();
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  const resetUserPassword = async (email: string) => {
    try {
      setError(null);
      setLoading(true);
      await resetPassword(email);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        unreadMessageCount,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword: resetUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
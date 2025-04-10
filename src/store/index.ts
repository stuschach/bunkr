import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types/auth';

// Define the store's state type
interface StoreState {
  // User and authentication
  user: UserProfile | null;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  setUser: (user: UserProfile | null) => void;
  setAuthStatus: (status: 'loading' | 'authenticated' | 'unauthenticated') => void;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Network status
  isOnline: boolean;
  setIsOnline: (isOnline: boolean) => void;
  
  // Messages
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
}

// Create the store
export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      // User and authentication
      user: null,
      authStatus: 'loading',
      setUser: (user) => set({ user }),
      setAuthStatus: (authStatus) => set({ authStatus }),
      
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Network status
      isOnline: true,
      setIsOnline: (isOnline) => set({ isOnline }),
      
      // Messages
      unreadMessageCount: 0,
      setUnreadMessageCount: (unreadMessageCount) => set({ unreadMessageCount }),
    }),
    {
      name: 'bunkr-storage', // Local storage key
      partialize: (state) => ({
        theme: state.theme, // Only persist theme
      }),
    }
  )
);

export default useStore;
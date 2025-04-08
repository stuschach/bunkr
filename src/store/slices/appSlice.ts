// src/store/slices/appSlice.ts
import { StateCreator } from 'zustand';

// Define the App state
export interface AppState {
  isLoading: boolean;
  globalError: {
    message: string;
    code?: string;
    details?: unknown;
  } | null;
  isOnline: boolean;
  lastUpdated: number | null;
}

// Define the App actions
export interface AppActions {
  setIsLoading: (isLoading: boolean) => void;
  setGlobalError: (error: AppState['globalError']) => void;
  clearGlobalError: () => void;
  setIsOnline: (isOnline: boolean) => void;
  updateLastUpdated: () => void;
}

// Create the App slice with simplified type
export const appSlice: StateCreator<AppState & AppActions> = (set) => ({
  // Initial state
  isLoading: false,
  globalError: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastUpdated: null,

  // Actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setGlobalError: (error) => set({ globalError: error }),
  clearGlobalError: () => set({ globalError: null }),
  setIsOnline: (isOnline) => set({ isOnline }),
  updateLastUpdated: () => set({ lastUpdated: Date.now() }),
});
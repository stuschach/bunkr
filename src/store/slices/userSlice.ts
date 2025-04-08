// src/store/slices/userSlice.ts
import { StateCreator } from 'zustand';
import { UserProfile } from '@/types/auth';

// Define the User state
export interface UserState {
  user: UserProfile | null;
  authStatus: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  userPreferences: {
    measurementUnit: 'yards' | 'meters';
    scorecardView: 'compact' | 'detailed';
    statsTimeframe: 'lastMonth' | 'lastThreeMonths' | 'lastYear' | 'allTime';
    notificationsEnabled: boolean;
  };
}

// Define the User actions
export interface UserActions {
  setUser: (user: UserProfile | null) => void;
  clearUser: () => void;
  setAuthStatus: (status: UserState['authStatus']) => void;
  updateUserPreferences: <K extends keyof UserState['userPreferences']>(
    key: K,
    value: UserState['userPreferences'][K]
  ) => void;
  resetUserPreferences: () => void;
}

// Default values for user preferences
const defaultUserPreferences: UserState['userPreferences'] = {
  measurementUnit: 'yards',
  scorecardView: 'detailed',
  statsTimeframe: 'lastThreeMonths',
  notificationsEnabled: true,
};

// Create the user slice with simplified type
export const userSlice: StateCreator<UserState & UserActions> = (set) => ({
  // Initial state
  user: null,
  authStatus: 'idle',
  userPreferences: defaultUserPreferences,

  // Actions
  setUser: (user) => set({ user, authStatus: user ? 'authenticated' : 'unauthenticated' }),
  clearUser: () => set({ user: null, authStatus: 'unauthenticated' }),
  setAuthStatus: (authStatus) => set({ authStatus }),
  updateUserPreferences: (key, value) =>
    set((state) => ({
      userPreferences: {
        ...state.userPreferences,
        [key]: value,
      },
    })),
  resetUserPreferences: () => set({ userPreferences: defaultUserPreferences }),
});
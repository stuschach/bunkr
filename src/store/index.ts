// src/store/index.ts
import { create } from 'zustand';
import { AppState, AppActions, appSlice } from './slices/appSlice';
import { UIState, UIActions, uiSlice } from './slices/uiSlice';
import { UserState, UserActions, userSlice } from './slices/userSlice';
import { logger } from './middleware';

// Define the combined store type
export type StoreState = AppState & UIState & UserState;
export type StoreActions = AppActions & UIActions & UserActions;

// Create the store with all slices
export const useStore = create<StoreState & StoreActions>()(
  logger((...args) => ({
    ...appSlice(...args),
    ...uiSlice(...args),
    ...userSlice(...args),
  }))
);
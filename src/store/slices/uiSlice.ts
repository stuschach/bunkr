// src/store/slices/uiSlice.ts
import { StateCreator } from 'zustand';

// Define the UI state
export interface UIState {
  theme: 'light' | 'dark' | 'system';
  isSidebarOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
}

// Define the UI actions
export interface UIActions {
  setTheme: (theme: UIState['theme']) => void;
  toggleTheme: () => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

// Create the UI slice with a simpler type definition
export const uiSlice: StateCreator<UIState & UIActions> = (set, get) => ({
  // Initial state
  theme: 'system',
  isSidebarOpen: false,
  activeModal: null,
  modalData: null,

  // Actions
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => {
    const currentTheme = get().theme;
    if (currentTheme === 'light') {
      set({ theme: 'dark' });
    } else if (currentTheme === 'dark') {
      set({ theme: 'light' });
    } else {
      // If system, check current preference and toggle opposite
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      set({ theme: prefersDark ? 'light' : 'dark' });
    }
  },
  setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  // Fix for the openModal function
  openModal: (modalId: string, data: Record<string, unknown> | null = null) => 
    set({ activeModal: modalId, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
});
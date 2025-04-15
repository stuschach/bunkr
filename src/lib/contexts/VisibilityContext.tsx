// src/lib/contexts/VisibilityContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useVisibilityManager } from '@/lib/hooks/useVisibilityManager';

// Define the context type
interface VisibilityContextType {
  // Register a post element for visibility tracking
  registerPost: (postId: string, element: HTMLElement | null) => (() => void) | undefined;
  // Check if a post is currently visible
  isPostVisible: (postId: string) => boolean;
  // Check if a post listener is active
  isPostActive: (postId: string) => boolean;
  // Force a post to be active regardless of visibility
  forcePostActive: (postId: string) => void;
  // Set of visible post IDs
  visiblePosts: Set<string>;
  // Set of posts with active listeners
  activePosts: Set<string>;
  // Stats for monitoring
  stats: {
    visibleCount: number;
    activeCount: number;
    observedCount: number;
  };
}

// Create the context with default values
const VisibilityContext = createContext<VisibilityContextType>({
  registerPost: () => undefined,
  isPostVisible: () => false,
  isPostActive: () => false,
  forcePostActive: () => {},
  visiblePosts: new Set(),
  activePosts: new Set(),
  stats: {
    visibleCount: 0,
    activeCount: 0,
    observedCount: 0
  }
});

// Provider component
export function VisibilityProvider({ children }: { children: ReactNode }) {
  const visibilityManager = useVisibilityManager({
    bufferTime: 5000, // 5 seconds by default
    enabled: true
  });

  return (
    <VisibilityContext.Provider value={visibilityManager}>
      {children}
    </VisibilityContext.Provider>
  );
}

// Hook to use the visibility context
export function useVisibility() {
  return useContext(VisibilityContext);
}
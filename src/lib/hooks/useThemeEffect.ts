// src/lib/hooks/useThemeEffect.ts
import { useEffect } from 'react';
import { useStore } from '@/store';

export function useThemeEffect() {
  const theme = useStore(state => state.theme);
  
  useEffect(() => {
    // Get the document element
    const root = window.document.documentElement;
    
    // Remove both classes to start fresh
    root.classList.remove('light', 'dark');
    
    // Apply the right theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.add('light');
    } else {
      // For 'system', check user preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemPrefersDark ? 'dark' : 'light');
      
      // Add listener for system preference changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
}
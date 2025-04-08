// src/lib/contexts/ResponsiveContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface BreakpointValues {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

const breakpoints: BreakpointValues = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

interface ResponsiveContextType {
  windowWidth: number;
  windowHeight: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: Breakpoint;
  isBreakpoint: (breakpoint: Breakpoint) => boolean;
  isGteBreakpoint: (breakpoint: Breakpoint) => boolean;
  isLteBreakpoint: (breakpoint: Breakpoint) => boolean;
}

const ResponsiveContext = createContext<ResponsiveContextType | undefined>(undefined);

export const ResponsiveProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const [mounted, setMounted] = useState(false);

  // Determine current breakpoint
  const determineBreakpoint = (width: number): Breakpoint => {
    if (width >= breakpoints['2xl']) return '2xl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return 'xs';
  };

  const breakpoint = determineBreakpoint(windowWidth);
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
  const isTablet = breakpoint === 'md' || breakpoint === 'lg';
  const isDesktop = breakpoint === 'xl' || breakpoint === '2xl';

  // Helper functions for breakpoint comparisons
  const isBreakpoint = (bp: Breakpoint): boolean => breakpoint === bp;
  
  const isGteBreakpoint = (bp: Breakpoint): boolean => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    const targetIndex = breakpointOrder.indexOf(bp);
    return currentIndex >= targetIndex;
  };
  
  const isLteBreakpoint = (bp: Breakpoint): boolean => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    const targetIndex = breakpointOrder.indexOf(bp);
    return currentIndex <= targetIndex;
  };

  useEffect(() => {
    setMounted(true);
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // For SSR, only render children once mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ResponsiveContext.Provider
      value={{
        windowWidth,
        windowHeight,
        isMobile,
        isTablet,
        isDesktop,
        breakpoint,
        isBreakpoint,
        isGteBreakpoint,
        isLteBreakpoint,
      }}
    >
      {children}
    </ResponsiveContext.Provider>
  );
};

// Custom hook to use the responsive context
export const useResponsive = () => {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error('useResponsive must be used within a ResponsiveProvider');
  }
  return context;
};
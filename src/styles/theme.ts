// src/styles/theme.ts
export const theme = {
    colors: {
      // Primary palette
      primary: {
        50: '#f0f7f0',
        100: '#d8ead9',
        200: '#b8d7ba',
        300: '#8fbc8f', // Light green
        400: '#6da96f',
        500: '#4d8a54', // Fairway green (main brand color)
        600: '#3f7245',
        700: '#2e5e33', // Dark green
        800: '#234927',
        900: '#17301a',
      },
      // Secondary palette
      secondary: {
        50: '#faf8f0',
        100: '#f5f0e0',
        200: '#ede4c7',
        300: '#e2d2a2', // Bunker sand
        400: '#d6c38c', // Darker sand
        500: '#c9b274',
        600: '#b09857',
        700: '#8c7944',
        800: '#665937',
        900: '#413a25',
      },
      // Sky/water palette
      sky: {
        50: '#f0f7fb',
        100: '#d9edf7',
        200: '#b0ddf0',
        300: '#87ceeb', // Light blue (sky)
        400: '#5db9e2',
        500: '#3d9bd1',
        600: '#4682b4', // Darker blue
        700: '#3a6992',
        800: '#2e516f',
        900: '#1e3447',
      },
      // Grayscale
      gray: {
        50: '#f8f8f8',
        100: '#f0f0f0',
        200: '#e4e4e4',
        300: '#d1d1d1',
        400: '#b4b4b4',
        500: '#9a9a9a',
        600: '#818181',
        700: '#666666',
        800: '#484848',
        900: '#212121',
      },
      // System colors
      success: '#34c759',
      warning: '#ff9500',
      error: '#ff3b30',
      info: '#5ac8fa',
      background: {
        light: '#ffffff',
        dark: '#121212',
      },
      text: {
        light: '#121212',
        dark: '#f8f8f8',
        muted: {
          light: '#666666',
          dark: '#a0a0a0',
        },
      },
      border: {
        light: '#e2e8f0',
        dark: '#2d3748',
      },
    },
    
    // Typography
    fontFamily: {
      heading: 'var(--font-titillium)',
      body: 'var(--font-inter)',
    },
    
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    
    // Spacing
    spacing: {
      0: '0',
      px: '1px',
      0.5: '0.125rem',
      1: '0.25rem',
      1.5: '0.375rem',
      2: '0.5rem',
      2.5: '0.625rem',
      3: '0.75rem',
      3.5: '0.875rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      8: '2rem',
      10: '2.5rem',
      12: '3rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      32: '8rem',
    },
    
    // Breakpoints
    breakpoints: {
      xs: '0px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    
    // Border radius
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      full: '9999px',
    },
    
    // Shadows
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    
    // Transitions
    transitions: {
      default: 'all 0.2s ease-in-out',
      fast: 'all 0.1s ease-in-out',
      slow: 'all 0.3s ease-in-out',
    },
    
    // Z-index
    zIndex: {
      0: 0,
      10: 10,
      20: 20,
      30: 30,
      40: 40,
      50: 50,
      auto: 'auto',
      dropdown: 1000,
      sticky: 1100,
      modal: 1300,
      popover: 1400,
      tooltip: 1500,
    },
  };
  
  // Helper to access deeply nested properties
  export const getThemeValue = (
    path: string,
    obj = theme
  ): string | number | undefined => {
    return path.split('.').reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj as any);
  };
  
  export default theme;
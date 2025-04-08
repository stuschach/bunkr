// src/lib/utils/device.ts
/**
 * Device detection utilities for responsive behavior adjustments
 */

// Check if code is running in browser
export const isBrowser = (): boolean => {
    return typeof window !== 'undefined';
  };
  
  // Check if user is on a mobile device
  export const isMobile = (): boolean => {
    if (!isBrowser()) return false;
    
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };
  
  // Check if user is on iOS - FIXED
  export const isIOS = (): boolean => {
    if (!isBrowser()) return false;
    
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !((window as any).MSStream);
  };
  
  // Check if user is on Android
  export const isAndroid = (): boolean => {
    if (!isBrowser()) return false;
    
    return /Android/i.test(navigator.userAgent);
  };
  
  // Check if user is on a tablet
  export const isTablet = (): boolean => {
    if (!isBrowser()) return false;
    
    const userAgent = navigator.userAgent;
    const isIPad = /iPad/i.test(userAgent);
    const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
    
    return isIPad || isAndroidTablet;
  };
  
  // Check if device is in portrait orientation
  export const isPortrait = (): boolean => {
    if (!isBrowser()) return true;
    
    return window.innerHeight > window.innerWidth;
  };
  
  // Check if device is in landscape orientation
  export const isLandscape = (): boolean => {
    if (!isBrowser()) return false;
    
    return window.innerWidth > window.innerHeight;
  };
  
  // Check if device supports touch events
  export const isTouchDevice = (): boolean => {
    if (!isBrowser()) return false;
    
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };
  
  // Check if user is on a high DPI display
  export const isRetinaDisplay = (): boolean => {
    if (!isBrowser()) return false;
    
    return (
      window.matchMedia &&
      (window.matchMedia('only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx), only screen and (min-resolution: 75.6dpcm)').matches ||
        window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min--moz-device-pixel-ratio: 2), only screen and (min-device-pixel-ratio: 2)').matches) ||
      (window.devicePixelRatio && window.devicePixelRatio >= 2)
    );
  };
  
  // Get device type (mobile, tablet, desktop)
  export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
    if (isTablet()) return 'tablet';
    if (isMobile()) return 'mobile';
    return 'desktop';
  };
  
  // Check if app is running as PWA
  export const isPWA = (): boolean => {
    if (!isBrowser()) return false;
    
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true;
  };
  
  // Check if browser supports WebP image format - FIXED
  export const supportsWebP = (): Promise<boolean> => {
    if (!isBrowser()) return Promise.resolve(false);
    
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    });
  };
  
  // Get browser name
  export const getBrowserName = (): string => {
    if (!isBrowser()) return 'unknown';
    
    const userAgent = navigator.userAgent;
    
    if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
    if (userAgent.indexOf('SamsungBrowser') > -1) return 'Samsung Browser';
    if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
    if (userAgent.indexOf('Trident') > -1) return 'Internet Explorer';
    if (userAgent.indexOf('Edge') > -1) return 'Edge';
    if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
    if (userAgent.indexOf('Safari') > -1) return 'Safari';
    
    return 'unknown';
  };
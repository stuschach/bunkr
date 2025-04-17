// src/lib/hooks/useWeather.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherData, fetchWeatherData } from '@/lib/services/weatherService';
import { getStorageItem, setStorageItem } from '@/lib/utils/storage';

interface UseWeatherOptions {
  cacheDuration?: number;
  defaultCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

type GeolocationStatus = 'idle' | 'prompt' | 'granted' | 'denied' | 'unavailable';

export function useWeather(options?: UseWeatherOptions) {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [coordinates, setCoordinates] = useState(options?.defaultCoordinates);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>('idle');
  
  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  
  // Flag to prevent multiple simultaneous requests
  const isLoadingData = useRef(false);
  
  // Default cache duration: 30 minutes
  const cacheDuration = options?.cacheDuration || 30 * 60 * 1000;
  
  // Check if geolocation is supported
  const isGeolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  
  // Set up mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Load last known coordinates from localStorage on mount only once
  useEffect(() => {
    if (coordinates) return;
    
    try {
      const lastPositionStr = localStorage.getItem('last_known_position');
      if (lastPositionStr) {
        const lastPosition = JSON.parse(lastPositionStr);
        if (lastPosition && lastPosition.latitude && lastPosition.longitude) {
          if (isMountedRef.current) {
            setCoordinates({
              latitude: lastPosition.latitude,
              longitude: lastPosition.longitude
            });
          }
        }
      }
    } catch (e) {
      console.error('Error loading last known position:', e);
    }
  }, []); // Empty dependencies = run once on mount
  
  // Get cached weather data
  const getCachedWeather = useCallback(() => {
    return getStorageItem(
      'cached_weather',
      { data: null, timestamp: 0, coordinates: undefined }
    );
  }, []);
  
  // Cache weather data
  const cacheWeatherData = useCallback((data: WeatherData, coords?: { latitude: number; longitude: number }) => {
    if (!isMountedRef.current) return;
    
    setStorageItem('cached_weather', {
      data,
      timestamp: Date.now(),
      coordinates: coords
    });
  }, []);
  
  // Check if cache is valid
  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < cacheDuration;
  }, [cacheDuration]);
  
  // Get user's geolocation with better error handling
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!isGeolocationSupported) {
        setGeolocationStatus('unavailable');
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }
      
      setGeolocationStatus('prompt');
      
      // Detect browser to adjust timeouts
      const isChrome = typeof navigator !== 'undefined' && 
        /Chrome/.test(navigator.userAgent) && 
        !/Edge|Edg/.test(navigator.userAgent);
      
      // Use longer timeout for Chrome
      const timeoutDuration = isChrome ? 30000 : 10000; // 30 seconds for Chrome, 10 for others
      
      // Create a manual timeout as a backup
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          setGeolocationStatus('unavailable');
        }
        reject(new Error('Location request manually timed out'));
      }, timeoutDuration + 5000); // Add 5 seconds buffer
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Clear the manual timeout
          clearTimeout(timeoutId);
          
          if (isMountedRef.current) {
            setGeolocationStatus('granted');
          }
          resolve(position);
        },
        (error) => {
          // Clear the manual timeout
          clearTimeout(timeoutId);
          
          // Handle specific geolocation errors
          if (error.code === error.PERMISSION_DENIED) {
            if (isMountedRef.current) {
              setGeolocationStatus('denied');
            }
            reject(new Error('Location access was denied'));
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            if (isMountedRef.current) {
              setGeolocationStatus('unavailable');
            }
            reject(new Error('Location information is unavailable'));
          } else if (error.code === error.TIMEOUT) {
            if (isMountedRef.current) {
              setGeolocationStatus('unavailable');
            }
            reject(new Error('Location request timed out'));
          } else {
            if (isMountedRef.current) {
              setGeolocationStatus('unavailable');
            }
            reject(new Error('An unknown error occurred'));
          }
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutDuration,
          maximumAge: 15 * 60 * 1000 // 15 minutes
        }
      );
    });
  }, [isGeolocationSupported]);
  
  // Modified version that returns coordinates directly
  const getCurrentPositionCoords = useCallback(async (): Promise<{latitude: number; longitude: number}> => {
    try {
      const position = await getCurrentPosition();
      
      // Ensure we have valid coordinates
      if (position && 
          position.coords && 
          typeof position.coords.latitude === 'number' && 
          typeof position.coords.longitude === 'number') {
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } else {
        throw new Error('Invalid position data received');
      }
    } catch (error) {
      console.error('Error getting position coordinates:', error);
      throw error;
    }
  }, [getCurrentPosition]);
  
  // Load weather data with a passed controller
  const loadWeatherData = useCallback(async (abortController?: AbortController) => {
    // Don't update state if unmounted or already loading
    if (!isMountedRef.current || isLoadingData.current) return;
    
    isLoadingData.current = true;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      
      // Check for valid cached data
      const cachedData = getCachedWeather();
      
      // Use cached data if valid and coordinates match
      if (cachedData.data && isCacheValid(cachedData.timestamp) && 
          (!coordinates || 
           (cachedData.coordinates &&
            typeof cachedData.coordinates === 'object' &&
            'latitude' in cachedData.coordinates &&
            'longitude' in cachedData.coordinates &&
            cachedData.coordinates.latitude === coordinates?.latitude &&
            cachedData.coordinates.longitude === coordinates?.longitude))) {
        if (isMountedRef.current) {
          setWeatherData(cachedData.data);
          setLoading(false);
        }
        isLoadingData.current = false;
        return;
      }
      
      // If offline and we have any cached data (even expired), use it
      if (typeof navigator !== 'undefined' && !navigator.onLine && cachedData.data) {
        if (isMountedRef.current) {
          setWeatherData(cachedData.data);
          setLoading(false);
        }
        isLoadingData.current = false;
        return;
      }
      
      // Fetch weather data with coordinates
      if (coordinates) {
        const data = await fetchWeatherData(
          coordinates.latitude, 
          coordinates.longitude
        );
        
        if (isMountedRef.current) {
          setWeatherData(data);
          cacheWeatherData(data, coordinates);
        }
      }
    } catch (err: any) {
      // Don't treat aborted requests as errors
      if (err.name === 'AbortError') {
        console.log('Weather request was cancelled');
        return;
      }
      
      console.error('Weather fetch error:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      
      // Try to use cached data on error
      const cachedData = getCachedWeather();
      if (cachedData.data && isMountedRef.current) {
        setWeatherData(cachedData.data);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isLoadingData.current = false;
    }
  }, [coordinates, getCachedWeather, isCacheValid, cacheWeatherData]);
  
  // Set custom coordinates
  const setCustomLocation = useCallback((latitude: number, longitude: number) => {
    if (!isMountedRef.current) return;
    setCoordinates({ latitude, longitude });
  }, []);
  
  // Load weather on coordinates change
  useEffect(() => {
    // Create controller inside this useEffect so it's available for cleanup
    const controller = new AbortController();
    
    // Only load if mounted and not already loading
    if (isMountedRef.current && !isLoadingData.current) {
      loadWeatherData(controller);
    }
    
    // Clean up function that aborts any in-progress requests
    return () => {
      controller.abort();
    };
  }, [coordinates, loadWeatherData]);
  
  // Public interface
  return {
    weatherData,
    loading,
    error,
    refreshWeather: useCallback(() => loadWeatherData(), [loadWeatherData]),
    setCustomLocation,
    geolocationStatus,
    isGeolocationSupported,
    getCurrentPosition: getCurrentPositionCoords
  };
}
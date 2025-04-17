// src/components/dashboard/WeatherWidget.tsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useWeather } from '@/lib/hooks/useWeather';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { LocationSelector } from '@/components/dashboard/LocationSelector';

interface WeatherWidgetProps {
  className?: string;
  compact?: boolean;
}

// Create the component that will be memoized
const WeatherWidgetComponent = ({ className, compact = false }: WeatherWidgetProps) => {
  const [locationSelectorOpen, setLocationSelectorOpen] = useState(false);
  const [customLocation, setCustomLocation] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUsingGeolocation, setIsUsingGeolocation] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  
  // Default to Pebble Beach as fallback coordinates
  const defaultCoordinates = { latitude: 36.5724, longitude: -121.9485 };
  
  // Load last known location from localStorage only once
  useEffect(() => {
    if (!isInitialLoad) return;
    
    try {
      const lastPositionStr = localStorage.getItem('last_known_position');
      if (lastPositionStr) {
        const lastPosition = JSON.parse(lastPositionStr);
        if (lastPosition.name) {
          setCustomLocation(lastPosition.name);
          if (lastPosition.isGeolocation) {
            setIsUsingGeolocation(true);
          }
        }
      }
    } catch (e) {
      console.error('Error loading last known position:', e);
    }
    
    setIsInitialLoad(false);
  }, [isInitialLoad]);
  
  const { 
    weatherData, 
    loading, 
    error, 
    refreshWeather, 
    setCustomLocation: updateLocation,
    geolocationStatus,
    isGeolocationSupported,
    getCurrentPosition
  } = useWeather({
    cacheDuration: 30 * 60 * 1000,
    defaultCoordinates
  });
  
  // Always attempt to get the user's location on initial load with better timeout handling
  useEffect(() => {
    // Skip if not initial load or geolocation not supported
    if (!isInitialLoad || !isGeolocationSupported) return;
    
    const tryGeolocation = async () => {
      // Set requesting flag to show loading state
      setIsRequestingLocation(true);
      
      // For Chrome browser, add additional timeout handling
      const isChrome = typeof navigator !== 'undefined' && 
        /Chrome/.test(navigator.userAgent) && 
        !/Edge|Edg/.test(navigator.userAgent);
      
      // Create a manual timeout that will trigger fallback
      let timeoutTriggered = false;
      const timeoutId = setTimeout(() => {
        timeoutTriggered = true;
        console.log('Manual geolocation timeout triggered - falling back to default location');
        
        // Fall back to default coordinates
        if (defaultCoordinates && 
            typeof defaultCoordinates.latitude === 'number' && 
            typeof defaultCoordinates.longitude === 'number') {
          handleLocationSelected(
            defaultCoordinates.latitude,
            defaultCoordinates.longitude,
            "Pebble Beach", // Default name
            false
          );
        }
        
        setIsRequestingLocation(false);
        setIsInitialLoad(false);
      }, isChrome ? 15000 : 12000); // Shorter than the API timeout
      
      try {
        // Directly request geolocation (will prompt for permission if not granted)
        const position = await getCurrentPosition();
        
        // Check if our manual timeout already triggered
        if (timeoutTriggered) {
          return; // Already handled by the timeout
        }
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        // Ensure we have valid coordinates before proceeding
        if (position && typeof position.latitude === 'number' && typeof position.longitude === 'number') {
          // Use the actual city name for better user experience
          const cityName = await getLocationNameFromCoords(position.latitude, position.longitude);
          
          handleLocationSelected(
            position.latitude,
            position.longitude,
            cityName || "Current Location",
            true
          );
        } else {
          throw new Error('Invalid position data received');
        }
      } catch (error) {
        // Clear the timeout if it hasn't triggered yet
        if (!timeoutTriggered) {
          clearTimeout(timeoutId);
        }
        
        // Only handle the error if our manual timeout hasn't triggered yet
        if (!timeoutTriggered) {
          console.log('Failed to get geolocation:', error);
          
          // Use default coordinates as fallback - with defensive check
          if (defaultCoordinates && 
              typeof defaultCoordinates.latitude === 'number' && 
              typeof defaultCoordinates.longitude === 'number') {
            handleLocationSelected(
              defaultCoordinates.latitude,
              defaultCoordinates.longitude,
              "Pebble Beach", // Default name
              false
            );
          }
        }
      } finally {
        // Only reset if the manual timeout hasn't triggered
        if (!timeoutTriggered) {
          setIsRequestingLocation(false);
          setIsInitialLoad(false);
        }
      }
    };
    
    // Start the geolocation request
    tryGeolocation();
    
    // No dependencies for handleLocationSelected to avoid re-running
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoad, isGeolocationSupported, getCurrentPosition]);
  
  // Memoize location selection handler
  const handleLocationSelected = useCallback(async (
    latitude: number, 
    longitude: number, 
    locationName: string,
    isGeolocated: boolean = false
  ) => {
    if (latitude && longitude) {
      // If this is a geolocation request, try to get city name
      if (isGeolocated) {
        try {
          // Get actual city name
          const cityName = await getLocationNameFromCoords(latitude, longitude);
          
          // Update location name if we got a valid name
          if (cityName && cityName !== "Current Location") {
            locationName = cityName;
          }
        } catch (error) {
          console.error('Error getting city name:', error);
          // Fallback to default "Current Location" name
        }
      }
      
      updateLocation(latitude, longitude);
      setCustomLocation(locationName || "Unknown Location");
      setIsUsingGeolocation(isGeolocated);
      
      // Store the selected location
      try {
        localStorage.setItem('last_known_position', JSON.stringify({
          latitude,
          longitude,
          name: locationName || "Unknown Location",
          isGeolocation: isGeolocated
        }));
      } catch (e) {
        console.error('Error storing location in local storage:', e);
      }
    }
  }, [updateLocation]);

  // Function to get location name from coordinates
  const getLocationNameFromCoords = async (latitude: number, longitude: number) => {
    try {
      // Using BigDataCloud's free reverse geocoding API
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      
      const data = await response.json();
      
      // Extract city/locality name from response
      let locationName = "Current Location"; // Default fallback
      
      if (data.locality) {
        // Use locality (city) as primary
        locationName = data.locality;
      } else if (data.city) {
        // Some APIs use city field instead
        locationName = data.city;
      } else if (data.principalSubdivision) {
        // Fall back to state/province if no city
        locationName = data.principalSubdivision;
      }
      
      // Include country for context if available
      if (data.countryName && locationName !== data.countryName) {
        locationName = `${locationName}, ${data.countryCode || data.countryName}`;
      }
      
      return locationName;
    } catch (error) {
      console.error('Error getting location name:', error);
      return "Current Location"; // Fallback
    }
  };

  // Handle refresh with geolocation
  const handleRefreshWeather = async () => {
    if (isUsingGeolocation) {
      try {
        setIsRequestingLocation(true);
        
        const position = await getCurrentPosition();
        
        // Get city name for coordinates
        const cityName = await getLocationNameFromCoords(
          position.latitude,
          position.longitude
        );
        
        handleLocationSelected(
          position.latitude,
          position.longitude,
          cityName || "Current Location",
          true
        );
        
        setIsRequestingLocation(false);
      } catch (error) {
        console.error('Error refreshing location:', error);
        // If geolocation fails on refresh, just refresh with current coordinates
        refreshWeather();
        setIsRequestingLocation(false);
      }
    } else {
      refreshWeather();
    }
  };

  // Get color for golf conditions - memoized
  const getGolfConditionColor = useCallback((condition: string) => {
    switch (condition) {
      case 'Excellent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Good':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Fair':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'Poor':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  }, []);

  // Loading state
  if ((loading && isInitialLoad) || isRequestingLocation) {
    return (
      <Card className={className}>
        <CardContent className="p-4 flex items-center justify-center">
          <LoadingSpinner 
            size="sm" 
            color="primary" 
            label={isRequestingLocation ? "Getting your location..." : "Loading weather..."} 
          />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center space-y-3">
            <p className="text-sm text-red-500 mb-2">Unable to load weather</p>
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={handleRefreshWeather}>Try Again</Button>
              <Button size="sm" variant="outline" onClick={() => setLocationSelectorOpen(true)}>
                Choose Location
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render component
  return (
    <>
      <Card className={className}>
        <CardContent className="p-4">
          {/* Weather content */}
          {weatherData && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <h3 className="text-sm font-semibold">
                    {customLocation || weatherData.location}
                    {isUsingGeolocation && (
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        (Current)
                      </span>
                    )}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-1 p-1 h-auto" 
                    onClick={() => setLocationSelectorOpen(true)}
                  >
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRefreshWeather}>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
                
              <div className="text-lg font-semibold">
                {Math.round(weatherData.temperature)}°F • {weatherData.condition}
              </div>
              
              <div className="mt-2">
                <Badge className={`${getGolfConditionColor(weatherData.golfConditions)} px-2 py-1`}>
                  {weatherData.golfConditions} Golf Conditions
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Location selector rendered outside card for cleaner UI */}
      <LocationSelector
        open={locationSelectorOpen}
        onClose={() => setLocationSelectorOpen(false)}
        onSelectLocation={handleLocationSelected}
        defaultCoordinates={defaultCoordinates}
      />
    </>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const WeatherWidget = memo(WeatherWidgetComponent);
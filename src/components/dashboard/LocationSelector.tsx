import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';

interface LocationSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectLocation: (latitude: number, longitude: number, locationName: string) => void;
  defaultCoordinates?: { latitude: number; longitude: number };
}

export function LocationSelector({ 
  open, 
  onClose, 
  onSelectLocation,
  defaultCoordinates
}: LocationSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  
  // Function to get location name from coordinates
  const getLocationNameFromCoords = async (latitude, longitude) => {
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
  
  // Get current location using browser geolocation API
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    
    setIsLoadingLocation(true);
    setLocationError(null);
    
    // Detect browser to adjust timeouts
    const isChrome = typeof navigator !== 'undefined' && 
      /Chrome/.test(navigator.userAgent) && 
      !/Edge|Edg/.test(navigator.userAgent);
    
    // Use longer timeout for Chrome
    const timeoutDuration = isChrome ? 30000 : 10000; // 30 seconds for Chrome, 10 for others
    
    // Create a manual timeout as a backup
    const timeoutId = setTimeout(() => {
      setIsLoadingLocation(false);
      setLocationError("Location request timed out. Please try again.");
    }, timeoutDuration + 5000); // Add 5 seconds buffer
    
    navigator.geolocation.getCurrentPosition(
      // Success handler
      async (position) => {
        // Clear the manual timeout
        clearTimeout(timeoutId);
        
        try {
          // Verify the position data is valid
          if (position && position.coords && 
              typeof position.coords.latitude === 'number' && 
              typeof position.coords.longitude === 'number') {
            
            // Get city name from coordinates
            const cityName = await getLocationNameFromCoords(
              position.coords.latitude,
              position.coords.longitude
            );
            
            onSelectLocation(
              position.coords.latitude,
              position.coords.longitude,
              cityName || "Current Location"
            );
            onClose();
          } else {
            throw new Error("Invalid position data received");
          }
        } catch (err) {
          setLocationError("Failed to get location name");
        } finally {
          setIsLoadingLocation(false);
        }
      },
      // Error handler
      (err) => {
        // Clear the manual timeout
        clearTimeout(timeoutId);
        setIsLoadingLocation(false);
        
        switch(err.code) {
          case 1: // PERMISSION_DENIED
            setLocationError("Location permission denied");
            break;
          case 2: // POSITION_UNAVAILABLE
            setLocationError("Location information is unavailable");
            break;
          case 3: // TIMEOUT
            setLocationError("Location request timed out - please check your browser settings");
            break;
          default:
            setLocationError("An unknown error occurred");
        }
      },
      // Options
      {
        enableHighAccuracy: false,
        timeout: timeoutDuration,
        maximumAge: 15 * 60 * 1000 // 15 minutes
      }
    );
  };
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setLocationError(null);
      setIsSearching(false);
      setIsLoadingLocation(false);
    } else {
      // Clear results when closing
      setResults([]);
      setSearchTerm('');
    }
  }, [open]);
  
  // Popular golf destinations for quick selection
  const popularLocations = [
    { name: 'Pebble Beach', region: 'California', country: 'USA', lat: 36.5724, lon: -121.9485 },
    { name: 'St Andrews', region: 'Scotland', country: 'UK', lat: 56.3398, lon: -2.8180 },
    { name: 'Augusta', region: 'Georgia', country: 'USA', lat: 33.5035, lon: -82.0239 },
    { name: 'Pinehurst', region: 'North Carolina', country: 'USA', lat: 35.1968, lon: -79.4681 },
  ];
  
  // Memoize handleSelectLocation to prevent causing re-renders
  const handleSelectLocation = useCallback((location) => {
    onSelectLocation(
      location.lat,
      location.lon,
      `${location.name}, ${location.region || location.country}`
    );
    onClose();
  }, [onSelectLocation, onClose]);
  
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Select Location</DialogTitle>
      </DialogHeader>
      <DialogContent>
        {/* Use current location button */}
        <div className="mb-4">
          <Button 
            onClick={handleGetCurrentLocation} 
            className="w-full"
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <svg 
                className="w-4 h-4 mr-2" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                />
              </svg>
            )}
            Use My Current Location
          </Button>
          
          {locationError && (
            <div className="mt-2 text-sm text-red-500">
              {locationError}
            </div>
          )}
        </div>
        
        <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium mb-2">Popular Golf Destinations</h3>
          <div className="grid grid-cols-2 gap-2">
            {popularLocations.map((location, index) => (
              <div
                key={`popular-${index}`}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => handleSelectLocation(location)}
              >
                <div className="font-medium">{location.name}</div>
                <div className="text-xs text-gray-500">
                  {location.region}, {location.country}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
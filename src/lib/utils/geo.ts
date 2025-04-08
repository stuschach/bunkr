// src/lib/utils/geo.ts
/**
 * Geolocation utilities for working with coordinates, distances, and locations
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

// Simple interface for geographic coordinates
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinate points using Haversine formula
 * @param point1 First coordinate
 * @param point2 Second coordinate
 * @returns Distance in kilometers
 */
export const calculateDistance = (point1: GeoCoordinates, point2: GeoCoordinates): number => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLong = toRadians(point2.longitude - point1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;
  
  return distance;
};

/**
 * Convert kilometers to miles
 * @param kilometers Distance in kilometers
 * @returns Distance in miles
 */
export const kilometersToMiles = (kilometers: number): number => {
  return kilometers * 0.621371;
};

/**
 * Convert miles to kilometers
 * @param miles Distance in miles
 * @returns Distance in kilometers
 */
export const milesToKilometers = (miles: number): number => {
  return miles * 1.60934;
};

/**
 * Get the user's current position as a Promise
 * @returns Promise resolving to coordinates
 */
export const getCurrentPosition = (): Promise<GeoCoordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      error => {
        reject(error);
      }
    );
  });
};

/**
 * Check if coordinates are within a given radius
 * @param center Center point
 * @param point Point to check
 * @param radiusKm Radius in kilometers
 * @returns Boolean indicating if point is within radius
 */
export const isWithinRadius = (
  center: GeoCoordinates,
  point: GeoCoordinates,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(center, point);
  return distance <= radiusKm;
};

/**
 * Format coordinates as a readable string
 * @param coordinates Coordinates to format
 * @returns Formatted string (e.g., "40.7128° N, 74.0060° W")
 */
export const formatCoordinates = (coordinates: GeoCoordinates): string => {
  const { latitude, longitude } = coordinates;
  const latDirection = latitude >= 0 ? 'N' : 'S';
  const longDirection = longitude >= 0 ? 'E' : 'W';
  
  return `${Math.abs(latitude).toFixed(4)}° ${latDirection}, ${Math.abs(longitude).toFixed(
    4
  )}° ${longDirection}`;
};

/**
 * Calculate the center point between multiple coordinates
 * @param points Array of coordinates
 * @returns Center point coordinates
 */
export const calculateCenterPoint = (points: GeoCoordinates[]): GeoCoordinates => {
  if (points.length === 0) {
    throw new Error('Cannot calculate center of empty array');
  }
  
  let totalLat = 0;
  let totalLong = 0;
  
  for (const point of points) {
    totalLat += point.latitude;
    totalLong += point.longitude;
  }
  
  return {
    latitude: totalLat / points.length,
    longitude: totalLong / points.length,
  };
};
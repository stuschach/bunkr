// src/lib/utils/storage.ts
/**
 * Local storage utilities with type safety
 */

// Check if window/localStorage is available (for SSR compatibility)
const isStorageAvailable = typeof window !== 'undefined' && window.localStorage !== undefined;

/**
 * Set an item in localStorage with JSON stringification
 * @param key Storage key
 * @param value Value to store
 */
export const setStorageItem = <T>(key: string, value: T): void => {
  if (!isStorageAvailable) return;
  
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    console.error('Error setting localStorage item:', error);
  }
};

/**
 * Get an item from localStorage with JSON parsing
 * @param key Storage key
 * @param defaultValue Default value if key doesn't exist
 * @returns Parsed value or default value
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (!isStorageAvailable) return defaultValue;
  
  try {
    const serializedValue = localStorage.getItem(key);
    if (serializedValue === null) return defaultValue;
    return JSON.parse(serializedValue) as T;
  } catch (error) {
    console.error('Error getting localStorage item:', error);
    return defaultValue;
  }
};

/**
 * Remove an item from localStorage
 * @param key Storage key
 */
export const removeStorageItem = (key: string): void => {
  if (!isStorageAvailable) return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing localStorage item:', error);
  }
};

/**
 * Clear all items from localStorage
 */
export const clearStorage = (): void => {
  if (!isStorageAvailable) return;
  
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};

/**
 * Get multiple storage items at once
 * @param keys Array of storage keys
 * @returns Object with key-value pairs
 */
export const getMultipleStorageItems = (keys: string[]): Record<string, any> => {
  if (!isStorageAvailable) return {};
  
  const result: Record<string, any> = {};
  
  for (const key of keys) {
    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue !== null) {
        result[key] = JSON.parse(serializedValue);
      }
    } catch (error) {
      console.error(`Error getting localStorage item '${key}':`, error);
    }
  }
  
  return result;
};

/**
 * Check if a key exists in localStorage
 * @param key Storage key
 * @returns Boolean indicating if key exists
 */
export const hasStorageItem = (key: string): boolean => {
  if (!isStorageAvailable) return false;
  return localStorage.getItem(key) !== null;
};

/**
 * Create a hook-compatible storage object
 * @param key Storage key
 * @param initialValue Initial value
 * @returns [value, setValue] tuple
 */
export const createStorage = <T>(key: string, initialValue: T) => {
  // Get from storage on initial load
  const storedValue = getStorageItem<T>(key, initialValue);
  
  return {
    value: storedValue,
    setValue: (value: T) => {
      setStorageItem(key, value);
    },
    removeValue: () => {
      removeStorageItem(key);
    },
  };
};
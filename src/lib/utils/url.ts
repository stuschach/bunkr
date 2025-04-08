// src/lib/utils/url.ts
/**
 * URL manipulation and handling utilities
 */

/**
 * Get query params from a URL or current window location
 * @param url Optional URL string (uses window.location if not provided)
 * @returns Record of query parameters
 */
export const getQueryParams = (url?: string): Record<string, string> => {
    const params: Record<string, string> = {};
    
    let urlObj: URL;
    
    if (url) {
      try {
        urlObj = new URL(url);
      } catch (e) {
        console.error('Invalid URL provided to getQueryParams:', e);
        return params;
      }
    } else if (typeof window !== 'undefined') {
      urlObj = new URL(window.location.href);
    } else {
      return params;
    }
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  };
  
  /**
   * Build a URL with query parameters
   * @param baseUrl Base URL
   * @param params Query parameters object
   * @returns URL string with query parameters
   */
  export const buildUrl = (baseUrl: string, params: Record<string, string | number | boolean>): string => {
    const url = new URL(baseUrl);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });
    
    return url.toString();
  };
  
  /**
   * Get a specific query parameter value
   * @param name Parameter name
   * @param url Optional URL string (uses window.location if not provided)
   * @returns Parameter value or null if not found
   */
  export const getQueryParam = (name: string, url?: string): string | null => {
    const params = getQueryParams(url);
    return params[name] || null;
  };
  
  /**
   * Update query parameters in the URL
   * @param params Parameters to update
   * @param url Optional URL string (uses window.location if not provided)
   * @returns New URL string
   */
  export const updateQueryParams = (
    params: Record<string, string | number | boolean>,
    url?: string
  ): string => {
    let urlObj: URL;
    
    if (url) {
      try {
        urlObj = new URL(url);
      } catch (e) {
        console.error('Invalid URL provided to updateQueryParams:', e);
        return url || '';
      }
    } else if (typeof window !== 'undefined') {
      urlObj = new URL(window.location.href);
    } else {
      return '';
    }
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        urlObj.searchParams.delete(key);
      } else {
        urlObj.searchParams.set(key, value.toString());
      }
    });
    
    return urlObj.toString();
  };
  
  /**
   * Remove query parameters from a URL
   * @param paramNames Parameter names to remove
   * @param url Optional URL string (uses window.location if not provided)
   * @returns New URL string
   */
  export const removeQueryParams = (paramNames: string[], url?: string): string => {
    let urlObj: URL;
    
    if (url) {
      try {
        urlObj = new URL(url);
      } catch (e) {
        console.error('Invalid URL provided to removeQueryParams:', e);
        return url || '';
      }
    } else if (typeof window !== 'undefined') {
      urlObj = new URL(window.location.href);
    } else {
      return '';
    }
    
    paramNames.forEach(name => {
      urlObj.searchParams.delete(name);
    });
    
    return urlObj.toString();
  };
  
  /**
   * Check if a URL is absolute
   * @param url URL to check
   * @returns Boolean indicating if URL is absolute
   */
  export const isAbsoluteUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  /**
   * Join URL segments safely
   * @param segments URL segments to join
   * @returns Joined URL
   */
  export const joinUrlSegments = (...segments: string[]): string => {
    return segments.map(segment => segment.replace(/^\/+|\/+$/g, '')).join('/');
  };
  
  /**
   * Get origin from URL
   * @param url URL string
   * @returns Origin or empty string if invalid
   */
  export const getUrlOrigin = (url: string): string => {
    try {
      return new URL(url).origin;
    } catch (e) {
      return '';
    }
  };
  
  /**
   * Get pathname from URL
   * @param url URL string
   * @returns Pathname or empty string if invalid
   */
  export const getUrlPathname = (url: string): string => {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return '';
    }
  };
  
  /**
   * Check if two URLs have the same origin
   * @param url1 First URL
   * @param url2 Second URL
   * @returns Boolean indicating if origins match
   */
  export const hasSameOrigin = (url1: string, url2: string): boolean => {
    try {
      const origin1 = new URL(url1).origin;
      const origin2 = new URL(url2).origin;
      return origin1 === origin2;
    } catch (e) {
      return false;
    }
  };
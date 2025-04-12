// src/lib/utils/location-formatter.ts

/**
 * Standardizes location string format to "City, ST" format
 */
export function formatLocationString(input: string): string {
    if (!input || !input.trim()) return '';
    
    // Split by comma and trim whitespace
    const parts = input.split(',').map(part => part.trim());
    
    if (parts.length < 2) return input.trim(); // Not enough parts
    
    // Get city and state
    const city = capitalizeWords(parts[0]);
    let state = parts[1].toUpperCase();
    
    // If state has more than 2 chars, try to convert to abbreviation
    if (state.length > 2) {
      state = getStateAbbreviation(state) || state;
    }
    
    return `${city}, ${state}`;
  }
  
  /**
   * Parse location string into city and state
   */
  export function parseLocationString(formattedLocation: string): { city: string; state: string } {
    if (!formattedLocation) {
      return { city: '', state: '' };
    }
    
    const parts = formattedLocation.split(',').map(part => part.trim());
    
    if (parts.length < 2) {
      return { city: parts[0] || '', state: '' };
    }
    
    return {
      city: parts[0],
      state: parts[1]
    };
  }
  
  /**
   * Helper to capitalize words
   */
  function capitalizeWords(text: string): string {
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Get state abbreviation from full name
   */
  function getStateAbbreviation(stateName: string): string | null {
    const stateMap: { [key: string]: string } = {
      'alabama': 'AL',
      'alaska': 'AK',
      'arizona': 'AZ',
      'arkansas': 'AR',
      'california': 'CA',
      'colorado': 'CO',
      'connecticut': 'CT',
      'delaware': 'DE',
      'florida': 'FL',
      'georgia': 'GA',
      'hawaii': 'HI',
      'idaho': 'ID',
      'illinois': 'IL',
      'indiana': 'IN',
      'iowa': 'IA',
      'kansas': 'KS',
      'kentucky': 'KY',
      'louisiana': 'LA',
      'maine': 'ME',
      'maryland': 'MD',
      'massachusetts': 'MA',
      'michigan': 'MI',
      'minnesota': 'MN',
      'mississippi': 'MS',
      'missouri': 'MO',
      'montana': 'MT',
      'nebraska': 'NE',
      'nevada': 'NV',
      'new hampshire': 'NH',
      'new jersey': 'NJ',
      'new mexico': 'NM',
      'new york': 'NY',
      'north carolina': 'NC',
      'north dakota': 'ND',
      'ohio': 'OH',
      'oklahoma': 'OK',
      'oregon': 'OR',
      'pennsylvania': 'PA',
      'rhode island': 'RI',
      'south carolina': 'SC',
      'south dakota': 'SD',
      'tennessee': 'TN',
      'texas': 'TX',
      'utah': 'UT',
      'vermont': 'VT',
      'virginia': 'VA',
      'washington': 'WA',
      'west virginia': 'WV',
      'wisconsin': 'WI',
      'wyoming': 'WY',
    };
    
    return stateMap[stateName.toLowerCase()] || null;
  }
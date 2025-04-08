// src/lib/utils/formatting.ts
/**
 * Text and data formatting utilities
 */

// Format a number with commas (e.g., 1,234,567)
export const formatNumber = (number: number): string => {
    return number.toLocaleString('en-US');
  };
  
  // Format a price with dollars (e.g., $1,234.56)
  export const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };
  
  // Format a name to title case (e.g., "john smith" -> "John Smith")
  export const formatTitleCase = (text: string): string => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Format a name with first initial and last name (e.g., "John Smith" -> "J. Smith")
  export const formatInitialLastName = (fullName: string): string => {
    const nameParts = fullName.split(' ');
    if (nameParts.length < 2) return fullName;
    
    return `${nameParts[0].charAt(0)}. ${nameParts[nameParts.length - 1]}`;
  };
  
  // Format a distance in yards or meters based on preference
  export const formatDistance = (
    distance: number, 
    unit: 'yards' | 'meters' = 'yards'
  ): string => {
    if (unit === 'yards') {
      return `${distance} yd`;
    }
    // Convert yards to meters
    const meters = Math.round(distance * 0.9144);
    return `${meters} m`;
  };
  
  // Format a file size (e.g., 1.5 MB)
  export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format a phone number (e.g., (123) 456-7890)
  export const formatPhoneNumber = (phone: string): string => {
    // Strip all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Handle US phone numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    // Handle phone numbers with country code
    if (cleaned.length === 11 && cleaned.charAt(0) === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    // Return original if not matching expected format
    return phone;
  };
  
  // Format a handicap index with +/- sign (e.g., "+2.1" or "-4.5")
  export const formatHandicapIndex = (handicap: number): string => {
    if (handicap <= 0) {
      return `+${Math.abs(handicap).toFixed(1)}`;
    }
    return handicap.toFixed(1);
  };
  
  // Format a scorecard total with relation to par (e.g., "72 (E)" or "75 (+3)")
  export const formatScoreWithRelationToPar = (score: number, par: number): string => {
    const relation = score - par;
    
    if (relation === 0) {
      return `${score} (E)`;
    }
    if (relation > 0) {
      return `${score} (+${relation})`;
    }
    return `${score} (${relation})`;
  };
  
  // Truncate a string with ellipsis (e.g., "This is a long text..." for 10 chars)
  export const truncateString = (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength - 3)}...`;
  };
  
  // Pluralize a word based on count (e.g., "1 hole", "2 holes")
  export const pluralize = (count: number, singular: string, plural?: string): string => {
    return `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`;
  };
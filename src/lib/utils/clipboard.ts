// src/lib/utils/clipboard.ts
/**
 * Clipboard utilities for copying and pasting
 */

/**
 * Copy text to clipboard
 * @param text Text to copy
 * @returns Promise resolving to success status
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) {
      console.warn('Clipboard API not available');
      return false;
    }
  
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  };
  
  /**
   * Read text from clipboard
   * @returns Promise resolving to clipboard text
   */
  export const readFromClipboard = async (): Promise<string | null> => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      console.warn('Clipboard reading not available');
      return null;
    }
  
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
      return null;
    }
  };
  
  /**
   * Copy a URL to clipboard with user-friendly feedback
   * @param url URL to copy
   * @param successCallback Optional callback when copy succeeds
   * @returns Promise resolving to success status
   */
  export const copyUrlToClipboard = async (
    url: string,
    successCallback?: () => void
  ): Promise<boolean> => {
    const success = await copyToClipboard(url);
    
    if (success && successCallback) {
      successCallback();
    }
    
    return success;
  };
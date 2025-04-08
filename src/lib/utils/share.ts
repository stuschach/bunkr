// src/lib/utils/share.ts
/**
 * Utilities for sharing content through various channels
 */

// Interface for share data
export interface ShareData {
    title?: string;
    text?: string;
    url?: string;
  }
  
  /**
   * Check if the Web Share API is available
   * @returns Boolean indicating if sharing is supported
   */
  export const isShareSupported = (): boolean => {
    return typeof navigator !== 'undefined' && !!navigator.share;
  };
  
  /**
   * Share content using the Web Share API if available
   * @param data Share data (title, text, url)
   * @returns Promise resolving to true if successful, false otherwise
   */
  export const shareContent = async (data: ShareData): Promise<boolean> => {
    if (!isShareSupported()) {
      return false;
    }
    
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // User cancelled or share failed
      console.error('Error sharing content:', error);
      return false;
    }
  };
  
  /**
   * Copy text to clipboard
   * @param text Text to copy
   * @returns Promise resolving to true if successful, false otherwise
   */
  export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  };
  
  /**
   * Share via email
   * @param recipient Email recipient
   * @param subject Email subject
   * @param body Email body
   * @returns Formatted mailto URL
   */
  export const shareViaEmail = (
    recipient: string,
    subject: string,
    body: string
  ): string => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    return `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
  };
  
  /**
   * Share to Twitter/X
   * @param text Tweet text
   * @param url URL to share (optional)
   * @returns Twitter share URL
   */
  export const shareToTwitter = (text: string, url?: string): string => {
    const encodedText = encodeURIComponent(text);
    const encodedUrl = url ? encodeURIComponent(url) : '';
    return `https://twitter.com/intent/tweet?text=${encodedText}${encodedUrl ? `&url=${encodedUrl}` : ''}`;
  };
  
  /**
   * Share to Facebook
   * @param url URL to share
   * @returns Facebook share URL
   */
  export const shareToFacebook = (url: string): string => {
    const encodedUrl = encodeURIComponent(url);
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  };
  
  /**
   * Share to WhatsApp
   * @param text Message text
   * @param url URL to share (optional)
   * @returns WhatsApp share URL
   */
  export const shareToWhatsApp = (text: string, url?: string): string => {
    const message = url ? `${text} ${url}` : text;
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/?text=${encodedMessage}`;
  };
  
  /**
   * Generate shareable message for a round of golf
   * @param courseName Name of the golf course
   * @param score Total score
   * @param par Course par
   * @param date Date of the round
   * @returns Formatted share message
   */
  export const generateRoundShareMessage = (
    courseName: string,
    score: number,
    par: number,
    date: string
  ): string => {
    const relation = score - par;
    let relationText = 'level par';
    
    if (relation > 0) {
      relationText = `+${relation} over par`;
    } else if (relation < 0) {
      relationText = `${relation} under par`;
    }
    
    return `I shot ${score} (${relationText}) at ${courseName} on ${date}. Check out my round on Bunkr!`;
  };
  
  /**
   * Format a round for share image (for social media preview)
   * @param data Round data
   * @returns Meta tags array for the head
   */
  export const formatRoundShareMetaTags = (
    roundData: {
      courseName: string;
      score: number;
      par: number;
      date: string;
      playerName: string;
    }
  ): { property: string; content: string }[] => {
    const { courseName, score, par, date, playerName } = roundData;
    const relation = score - par;
    
    let relationText = 'level par';
    if (relation > 0) {
      relationText = `+${relation} over par`;
    } else if (relation < 0) {
      relationText = `${relation} under par`;
    }
    
    const title = `${playerName} shot ${score} (${relationText}) at ${courseName}`;
    const description = `Round played on ${date}. View the full scorecard on Bunkr!`;
    
    return [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'twitter:card', content: 'summary_large_image' },
      { property: 'twitter:title', content: title },
      { property: 'twitter:description', content: description },
    ];
  };
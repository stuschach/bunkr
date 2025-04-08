// src/lib/utils/dom.ts
/**
 * DOM utilities for working with HTML elements
 */

/**
 * Get the scrollbar width
 * @returns Scrollbar width in pixels
 */
export const getScrollbarWidth = (): number => {
    if (typeof document === 'undefined') return 0;
    
    // Create outer container
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    document.body.appendChild(outer);
    
    // Create inner container
    const inner = document.createElement('div');
    outer.appendChild(inner);
    
    // Calculate width difference
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    
    // Remove containers
    outer.parentNode?.removeChild(outer);
    
    return scrollbarWidth;
  };
  
  /**
   * Lock body scroll (useful for modals)
   */
  export const lockBodyScroll = (): void => {
    if (typeof document === 'undefined') return;
    
    // Get current body padding
    const currentPadding = parseInt(
      window.getComputedStyle(document.body).getPropertyValue('padding-right'),
      10
    ) || 0;
    
    // Add scrollbar width to padding to prevent layout shifting
    const scrollbarWidth = getScrollbarWidth();
    document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
  };
  
  /**
   * Unlock body scroll
   */
  export const unlockBodyScroll = (): void => {
    if (typeof document === 'undefined') return;
    
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
  };
  
  /**
   * Check if an element is in viewport
   * @param element Element to check
   * @param offset Optional offset to consider element visible before it enters viewport
   * @returns Boolean indicating if element is in viewport
   */
  export const isElementInViewport = (
    element: HTMLElement,
    offset = 0
  ): boolean => {
    if (typeof window === 'undefined') return false;
    
    const rect = element.getBoundingClientRect();
    
    return (
      rect.top - offset < window.innerHeight &&
      rect.bottom + offset > 0 &&
      rect.left - offset < window.innerWidth &&
      rect.right + offset > 0
    );
  };
  
  /**
   * Smoothly scroll to element
   * @param element Element or selector to scroll to
   * @param offset Offset from the top
   * @param duration Animation duration in milliseconds
   */
  export const scrollToElement = (
    element: HTMLElement | string,
    offset = 0,
    duration = 500
  ): void => {
    if (typeof window === 'undefined') return;
    
    let targetElement: HTMLElement | null;
    
    if (typeof element === 'string') {
      targetElement = document.querySelector(element);
    } else {
      targetElement = element;
    }
    
    if (!targetElement) return;
    
    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime: number | null = null;
    
    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Easing function (easeInOutQuad)
      const easeProgress = 
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      window.scrollTo(0, startPosition + distance * easeProgress);
      
      if (timeElapsed < duration) {
        window.requestAnimationFrame(animation);
      }
    };
    
    window.requestAnimationFrame(animation);
  };
  
  /**
   * Add event listener with automatic cleanup
   * @param element Target element
   * @param event Event name
   * @param handler Event handler
   * @param options Event listener options
   * @returns Cleanup function
   */
  export const addEventListenerWithCleanup = <K extends keyof HTMLElementEventMap>(
    element: HTMLElement | Document | Window,
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): () => void => {
    element.addEventListener(event, handler as EventListener, options);
    
    return () => {
      element.removeEventListener(event, handler as EventListener, options);
    };
  };
  
  /**
   * Focus the first focusable element in a container
   * @param container Container element
   */
  export const focusFirstElement = (container: HTMLElement): void => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  };
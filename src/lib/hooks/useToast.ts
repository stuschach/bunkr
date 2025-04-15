// src/lib/hooks/useToast.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ToastVariant, ToastPosition } from '@/components/common/feedback/Toast';

// Interface for toast data
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  position?: ToastPosition;
  onClose?: () => void;
}

// Unique ID generator for toasts
const generateId = () => `toast-${Math.random().toString(36).substring(2, 9)}`;

export function useToast() {
  // State to manage toast visibility
  const [isOpen, setIsOpen] = useState(false);
  
  // State to store toast configuration
  const [toast, setToast] = useState<ToastOptions & { id: string }>({
    id: '',
    title: '',
    description: '',
    variant: 'info',
    duration: 5000,
    position: 'top-right'
  });
  
  // Track if component is mounted
  const isMountedRef = useRef(false);
  
  // Set mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Close toast function
  const closeToast = useCallback(() => {
    if (isMountedRef.current) {
      setIsOpen(false);
      
      // Call onClose callback if provided
      if (toast.onClose) {
        toast.onClose();
      }
    }
  }, [toast]);
  
  // Show toast function
  const showToast = useCallback((options: ToastOptions) => {
    if (!isMountedRef.current) return;
    
    // Close any existing toast first
    setIsOpen(false);
    
    // Small delay before showing new toast for better UX
    setTimeout(() => {
      if (!isMountedRef.current) return;
      
      const id = generateId();
      setToast({
        id,
        title: options.title,
        description: options.description,
        variant: options.variant || 'info',
        duration: options.duration !== undefined ? options.duration : 5000,
        position: options.position || 'top-right',
        onClose: options.onClose
      });
      
      setIsOpen(true);
    }, 100);
  }, []);
  
  return {
    isOpen,
    toast,
    showToast,
    closeToast
  };
}

// Helper to provide a global toast context
const globalToastData = {
  showToast: null as ((options: ToastOptions) => void) | null,
};

// Function to show toast from anywhere (outside of components)
export function showGlobalToast(options: ToastOptions) {
  if (globalToastData.showToast) {
    globalToastData.showToast(options);
  } else {
    // Queue the toast if not ready yet
    setTimeout(() => showGlobalToast(options), 500);
  }
}

// Function to register the toast showToast function
export function registerGlobalToast(showToast: (options: ToastOptions) => void) {
  globalToastData.showToast = showToast;
}
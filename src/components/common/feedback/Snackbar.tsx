// src/components/common/feedback/Snackbar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';

export interface SnackbarProps {
  open: boolean;
  message: string;
  type?: SnackbarType;
  autoHideDuration?: number;
  onClose?: () => void;
}

// Icons for different snackbar types
const SnackbarIcon = ({ type }: { type: SnackbarType }) => {
  switch (type) {
    case 'success':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
};

// Close icon (X) as inline SVG
const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Background colors by type
const bgColors: Record<SnackbarType, string> = {
  success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
};

export function Snackbar({
  open,
  message,
  type = 'info',
  autoHideDuration = 5000,
  onClose
}: SnackbarProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (open && autoHideDuration > 0) {
      const timer = setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, autoHideDuration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [open, autoHideDuration, onClose]);

  if (!isMounted) return null;

  // Use portal to render at the top level of the DOM
  return createPortal(
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-6 pointer-events-none ${!open ? 'hidden' : ''}`}
    >
      <div className="pointer-events-auto transform transition-all duration-200 ease-in-out">
        <div
          className={`flex items-center px-4 py-3 rounded-lg shadow-lg ${bgColors[type]}`}
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(20px)'
          }}
        >
          <div className="mr-3">
            <SnackbarIcon type={type} />
          </div>
          <div className="flex-1 mr-2">{message}</div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Context for managing global snackbar
interface SnackbarContextType {
  showSnackbar: (message: string, type?: SnackbarType) => void;
  hideSnackbar: () => void;
}

const SnackbarContext = React.createContext<SnackbarContextType | undefined>(undefined);

interface SnackbarProviderProps {
  children: React.ReactNode;
}

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<SnackbarType>('info');

  const showSnackbar = (message: string, type: SnackbarType = 'info') => {
    setMessage(message);
    setType(type);
    setOpen(true);
  };

  const hideSnackbar = () => {
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
      {children}
      <Snackbar
        open={open}
        message={message}
        type={type}
        onClose={hideSnackbar}
      />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = React.useContext(SnackbarContext);
  if (context === undefined) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
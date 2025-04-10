// src/components/ui/Dialog.tsx
import React, { Fragment, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeOnClickOutside?: boolean;
  closeOnEsc?: boolean;
}

export interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export const Dialog = ({
  open,
  onClose,
  children,
  className,
  closeOnClickOutside = true,
  closeOnEsc = true,
}: DialogProps) => {
  const [mounted, setMounted] = React.useState(false);
  
  // Simple mount effect without dependencies on 'open'
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Separate effect for keyboard handler
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, closeOnEsc]);

  if (!mounted) return null;

  // Only render backdrop and content when open
  return createPortal(
    <>
      {open && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeOnClickOutside ? onClose : undefined}
        >
          <div 
            className={cn(
              "relative max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900",
              "transform transition-all duration-200 ease-in-out",
              "animate-fade-in",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export const DialogHeader = ({ children, className }: DialogHeaderProps) => {
  return (
    <div
      className={cn(
        "mb-4 pb-3 border-b border-gray-200 dark:border-gray-800",
        className
      )}
    >
      {children}
    </div>
  );
};

export const DialogTitle = ({ children, className }: DialogTitleProps) => {
  return (
    <h3
      className={cn(
        "text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100",
        className
      )}
    >
      {children}
    </h3>
  );
};

export const DialogDescription = ({ children, className }: DialogDescriptionProps) => {
  return (
    <p
      className={cn(
        "mt-2 text-sm text-gray-500 dark:text-gray-400",
        className
      )}
    >
      {children}
    </p>
  );
};

export const DialogContent = ({ children, className }: DialogContentProps) => {
  return (
    <div className={cn("py-4", className)}>
      {children}
    </div>
  );
};

export const DialogFooter = ({ children, className }: DialogFooterProps) => {
  return (
    <div
      className={cn(
        "mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-2",
        className
      )}
    >
      {children}
    </div>
  );
};
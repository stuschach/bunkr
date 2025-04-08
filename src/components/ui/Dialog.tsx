// src/components/ui/Dialog.tsx
import React, { Fragment, ReactNode } from 'react';
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

  React.useEffect(() => {
    setMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };
    
    if (open && closeOnEsc) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, closeOnEsc]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnClickOutside && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <Fragment>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <div
            className={cn(
              "relative max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900",
              "transform transition-all duration-200 ease-in-out",
              "animate-fade-in", // Assuming we have this animation in our global CSS
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      )}
    </Fragment>,
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
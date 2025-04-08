// src/components/ui/Sheet.tsx
import React, { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeOnClickOutside?: boolean;
  closeOnEsc?: boolean;
}

export function Sheet({
  open,
  onClose,
  children,
  className,
  position = 'right',
  size = 'md',
  closeOnClickOutside = true,
  closeOnEsc = true,
}: SheetProps) {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };
    
    if (open && closeOnEsc) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scrolling when sheet is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore body scrolling
      document.body.style.overflow = '';
    };
  }, [open, onClose, closeOnEsc]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnClickOutside && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Size styles
  const sizeStyles = {
    left: {
      sm: 'w-64',
      md: 'w-80',
      lg: 'w-96',
      full: 'w-screen',
    },
    right: {
      sm: 'w-64',
      md: 'w-80',
      lg: 'w-96',
      full: 'w-screen',
    },
    top: {
      sm: 'h-1/4',
      md: 'h-1/3',
      lg: 'h-1/2',
      full: 'h-screen',
    },
    bottom: {
      sm: 'h-1/4',
      md: 'h-1/3',
      lg: 'h-1/2',
      full: 'h-screen',
    },
  };

  // Position styles
  const positionStyles = {
    left: 'inset-y-0 left-0',
    right: 'inset-y-0 right-0',
    top: 'inset-x-0 top-0',
    bottom: 'inset-x-0 bottom-0',
  };

  // Animation classes
  const animationStyles = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    top: open ? 'translate-y-0' : '-translate-y-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        !open && "pointer-events-none opacity-0",
        open && "animate-fade-in"
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "fixed bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-in-out",
          positionStyles[position],
          sizeStyles[position][size],
          animationStyles[position],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export interface SheetHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface SheetTitleProps {
  children: ReactNode;
  className?: string;
}

export interface SheetDescriptionProps {
  children: ReactNode;
  className?: string;
}

export interface SheetContentProps {
  children: ReactNode;
  className?: string;
}

export interface SheetFooterProps {
  children: ReactNode;
  className?: string;
}

export function SheetHeader({ children, className }: SheetHeaderProps) {
  return (
    <div
      className={cn(
        "px-6 py-4 border-b border-gray-200 dark:border-gray-800",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold text-gray-900 dark:text-gray-100",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function SheetDescription({ children, className }: SheetDescriptionProps) {
  return (
    <p
      className={cn(
        "mt-1 text-sm text-gray-500 dark:text-gray-400",
        className
      )}
    >
      {children}
    </p>
  );
}

export function SheetContent({ children, className }: SheetContentProps) {
  return (
    <div className={cn("p-6 overflow-y-auto flex-grow", className)}>
      {children}
    </div>
  );
}

export function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <div
      className={cn(
        "px-6 py-4 border-t border-gray-200 dark:border-gray-800",
        className
      )}
    >
      {children}
    </div>
  );
}
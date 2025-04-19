// src/components/common/dialogs/ConfirmationDialog.tsx
'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ConfirmationDialogVariant = 'default' | 'destructive' | 'warning' | 'info';

interface ConfirmationDialogProps {
  /**
   * Title of the confirmation dialog
   */
  title: string;
  
  /**
   * Message to display in the confirmation dialog
   */
  message: string | React.ReactNode;
  
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  
  /**
   * Callback when user confirms the action
   */
  onConfirm: () => void;
  
  /**
   * Callback when user cancels the action
   */
  onCancel: () => void;
  
  /**
   * Label for the confirm button
   */
  confirmLabel?: string;
  
  /**
   * Label for the cancel button
   */
  cancelLabel?: string;
  
  /**
   * Variant of the confirmation dialog which affects the icon and confirm button styling
   */
  confirmVariant?: ConfirmationDialogVariant;
  
  /**
   * Whether the confirm action is in progress
   */
  isConfirming?: boolean;
  
  /**
   * Additional content to display at the bottom of the dialog
   */
  additionalContent?: React.ReactNode;
}

export function ConfirmationDialog({
  title,
  message,
  isOpen,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  isConfirming = false,
  additionalContent
}: ConfirmationDialogProps) {
  // Determine icon based on variant
  const getIcon = () => {
    switch (confirmVariant) {
      case 'destructive':
        return <AlertCircle className="h-6 w-6 text-red-500 mr-2 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-500 mr-2 flex-shrink-0" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-500 mr-2 flex-shrink-0" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-gray-500 mr-2 flex-shrink-0" />;
    }
  };
  
  // Determine button variant based on dialog variant
  const getButtonVariant = () => {
    switch (confirmVariant) {
      case 'destructive':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };
  
  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      
      <DialogContent>
        <div className="flex items-start">
          {getIcon()}
          {typeof message === 'string' ? (
            <Text className="text-gray-700 dark:text-gray-300">{message}</Text>
          ) : (
            message
          )}
        </div>
        
        {additionalContent && (
          <div className="mt-4">
            {additionalContent}
          </div>
        )}
      </DialogContent>
      
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={getButtonVariant()}
          onClick={onConfirm}
          isLoading={isConfirming}
          disabled={isConfirming}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
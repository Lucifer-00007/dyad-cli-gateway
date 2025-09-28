import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConfirmationVariant = 'default' | 'destructive' | 'warning' | 'info';

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

const variantConfig = {
  default: {
    icon: Info,
    iconClassName: 'text-blue-500',
    confirmButtonVariant: 'default' as const,
  },
  destructive: {
    icon: AlertTriangle,
    iconClassName: 'text-destructive',
    confirmButtonVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-yellow-500',
    confirmButtonVariant: 'default' as const,
  },
  info: {
    icon: CheckCircle,
    iconClassName: 'text-blue-500',
    confirmButtonVariant: 'default' as const,
  },
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  disabled = false,
  children,
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Error handling should be done by the parent component
      console.error('Confirmation action failed:', error);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('flex-shrink-0', config.iconClassName)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children && (
          <div className="py-4">
            {children}
          </div>
        )}

        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={config.confirmButtonVariant}
              onClick={handleConfirm}
              disabled={disabled || loading}
              className="gap-2"
            >
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Hook for easier usage
export const useConfirmationDialog = () => {
  const [dialogState, setDialogState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmationVariant;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    loading?: boolean;
    disabled?: boolean;
    children?: React.ReactNode;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showConfirmation = React.useCallback((config: Omit<typeof dialogState, 'open'>) => {
    setDialogState({ ...config, open: true });
  }, []);

  const hideConfirmation = React.useCallback(() => {
    setDialogState(prev => ({ ...prev, open: false }));
  }, []);

  const ConfirmationDialogComponent = React.useCallback(() => (
    <ConfirmationDialog
      {...dialogState}
      onOpenChange={hideConfirmation}
    />
  ), [dialogState, hideConfirmation]);

  return {
    showConfirmation,
    hideConfirmation,
    ConfirmationDialog: ConfirmationDialogComponent,
  };
};

// Preset confirmation dialogs for common use cases
export const useDeleteConfirmation = () => {
  const { showConfirmation, hideConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const showDeleteConfirmation = React.useCallback((
    itemName: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      description?: string;
      confirmText?: string;
      onCancel?: () => void;
    }
  ) => {
    showConfirmation({
      title: `Delete ${itemName}?`,
      description: options?.description || `This action cannot be undone. This will permanently delete the ${itemName.toLowerCase()}.`,
      confirmText: options?.confirmText || 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm,
      onCancel: options?.onCancel,
    });
  }, [showConfirmation]);

  return {
    showDeleteConfirmation,
    hideConfirmation,
    ConfirmationDialog,
  };
};

export const useUnsavedChangesConfirmation = () => {
  const { showConfirmation, hideConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const showUnsavedChangesConfirmation = React.useCallback((
    onConfirm: () => void | Promise<void>,
    options?: {
      title?: string;
      description?: string;
      confirmText?: string;
      onCancel?: () => void;
    }
  ) => {
    showConfirmation({
      title: options?.title || 'Unsaved Changes',
      description: options?.description || 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
      confirmText: options?.confirmText || 'Leave',
      cancelText: 'Stay',
      variant: 'warning',
      onConfirm,
      onCancel: options?.onCancel,
    });
  }, [showConfirmation]);

  return {
    showUnsavedChangesConfirmation,
    hideConfirmation,
    ConfirmationDialog,
  };
};
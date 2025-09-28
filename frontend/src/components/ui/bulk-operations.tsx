/**
 * Bulk operations UI components with progress tracking
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Download,
} from 'lucide-react';
import { BulkOperation } from '@/hooks/use-bulk-operations';
import { formatDistanceToNow } from 'date-fns';

export interface BulkOperationProgressProps {
  operation: BulkOperation;
  onCancel?: () => void;
  onRetry?: () => void;
  onClear?: () => void;
}

export const BulkOperationProgress: React.FC<BulkOperationProgressProps> = ({
  operation,
  onCancel,
  onRetry,
  onClear,
}) => {
  const getStatusIcon = () => {
    switch (operation.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (operation.status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium">{operation.type}</span>
          <Badge variant="outline">
            {operation.progress.completed} / {operation.progress.total}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          {operation.status === 'running' && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Square className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
          {operation.status === 'failed' && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <Play className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {['completed', 'failed', 'cancelled'].includes(operation.status) && onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{operation.progress.percentage}% complete</span>
          {operation.status === 'running' && operation.estimatedTimeRemaining && (
            <span>~{formatTimeRemaining(operation.estimatedTimeRemaining)} remaining</span>
          )}
        </div>
        <Progress value={operation.progress.percentage} className="h-2" />
      </div>

      {operation.results.failed.length > 0 && (
        <div className="flex items-center space-x-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>{operation.results.failed.length} items failed</span>
        </div>
      )}

      {operation.startTime && (
        <div className="text-xs text-muted-foreground">
          Started {formatDistanceToNow(operation.startTime, { addSuffix: true })}
          {operation.endTime && (
            <span>
              {' '}• Completed {formatDistanceToNow(operation.endTime, { addSuffix: true })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export interface BulkOperationManagerProps {
  operations: BulkOperation[];
  onCancel?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  onClear?: (operationId: string) => void;
  onClearAll?: () => void;
}

export const BulkOperationManager: React.FC<BulkOperationManagerProps> = ({
  operations,
  onCancel,
  onRetry,
  onClear,
  onClearAll,
}) => {
  const activeOperations = operations.filter(op => 
    ['pending', 'running'].includes(op.status)
  );
  const completedOperations = operations.filter(op => 
    ['completed', 'failed', 'cancelled'].includes(op.status)
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          Bulk Operations
          {activeOperations.length > 0 && (
            <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
              {activeOperations.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Bulk Operations</SheetTitle>
          <SheetDescription>
            Monitor and manage bulk operations in progress
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {activeOperations.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Active Operations</h3>
              <div className="space-y-3">
                {activeOperations.map(operation => (
                  <BulkOperationProgress
                    key={operation.id}
                    operation={operation}
                    onCancel={() => onCancel?.(operation.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedOperations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Recent Operations</h3>
                {onClearAll && (
                  <Button variant="ghost" size="sm" onClick={onClearAll}>
                    Clear All
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {completedOperations.map(operation => (
                    <BulkOperationProgress
                      key={operation.id}
                      operation={operation}
                      onRetry={() => onRetry?.(operation.id)}
                      onClear={() => onClear?.(operation.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {operations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No bulk operations yet
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export interface BulkSelectionBarProps<T> {
  selectedItems: T[];
  totalItems: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (items: T[]) => void;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
  }>;
}

export function BulkSelectionBar<T>({
  selectedItems,
  totalItems,
  onSelectAll,
  onClearSelection,
  actions,
}: BulkSelectionBarProps<T>) {
  const [isVisible, setIsVisible] = useState(selectedItems.length > 0);

  React.useEffect(() => {
    setIsVisible(selectedItems.length > 0);
  }, [selectedItems.length]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[400px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Checkbox
              checked={selectedItems.length === totalItems}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectAll();
                } else {
                  onClearSelection();
                }
              }}
            />
            <span className="text-sm font-medium">
              {selectedItems.length} of {totalItems} selected
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={() => action.onClick(selectedItems)}
                disabled={action.disabled || selectedItems.length === 0}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface BulkOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const BulkOperationDialog: React.FC<BulkOperationDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  itemCount,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            <br />
            <strong>{itemCount} items</strong> will be affected by this operation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
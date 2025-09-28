/**
 * API Key Revocation Dialog Component
 * Handles revoking API keys with immediate effect and audit logging
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Shield, Clock, Activity, Key, Trash2 } from 'lucide-react';
import { useApiKey, useRevokeApiKey, useRegenerateApiKey } from '@/hooks/api/use-api-keys';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ApiKeyRevocationDialogProps {
  keyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApiKeyRevocationDialog: React.FC<ApiKeyRevocationDialogProps> = ({
  keyId,
  open,
  onClose,
  onSuccess,
}) => {
  const [action, setAction] = useState<'revoke' | 'regenerate' | null>(null);
  const [reason, setReason] = useState('');
  const [confirmUnderstanding, setConfirmUnderstanding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: apiKey, isLoading } = useApiKey(keyId, open);
  const revokeMutation = useRevokeApiKey();
  const regenerateMutation = useRegenerateApiKey();
  const { toast } = useToast();

  const handleRevoke = async () => {
    if (!confirmUnderstanding || !apiKey) return;

    setIsProcessing(true);
    try {
      await revokeMutation.mutateAsync(keyId);
      
      toast({
        title: "API Key Revoked",
        description: `${apiKey.name} has been revoked and is no longer valid.`,
        variant: "default",
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Revocation Failed",
        description: "Failed to revoke the API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirmUnderstanding || !apiKey) return;

    setIsProcessing(true);
    try {
      const result = await regenerateMutation.mutateAsync(keyId);
      
      toast({
        title: "API Key Regenerated",
        description: `A new key has been generated for ${apiKey.name}. The old key is no longer valid.`,
        variant: "default",
      });

      // Show the new key in a secure display
      // This would typically open the ApiKeySecureDisplay component
      onSuccess();
    } catch (error) {
      toast({
        title: "Regeneration Failed",
        description: "Failed to regenerate the API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = () => {
    if (action === 'revoke') {
      handleRevoke();
    } else if (action === 'regenerate') {
      handleRegenerate();
    }
  };

  const resetForm = () => {
    setAction(null);
    setReason('');
    setConfirmUnderstanding(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (isLoading || !apiKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isEnabled = apiKey.enabled;
  const lastUsed = apiKey.lastUsed ? new Date(apiKey.lastUsed) : null;
  const usageToday = apiKey.usage.requestsToday;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Manage API Key</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* API Key Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>{apiKey.name}</span>
                </div>
                <Badge variant={isEnabled ? "default" : "destructive"}>
                  {isEnabled ? "Active" : "Revoked"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Key Prefix</Label>
                  <p className="text-sm text-muted-foreground">{apiKey.keyPrefix}***</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Used</Label>
                  <p className="text-sm text-muted-foreground">
                    {lastUsed ? formatDistanceToNow(lastUsed, { addSuffix: true }) : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Usage Today</Label>
                  <p className="text-sm text-muted-foreground">
                    {usageToday} requests, {apiKey.usage.tokensToday.toLocaleString()} tokens
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Permissions</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {apiKey.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Selection */}
          {!action && isEnabled && (
            <div className="space-y-4">
              <h3 className="font-medium">What would you like to do?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setAction('revoke')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">Revoke Key</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Permanently disable this API key. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setAction('regenerate')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Regenerate Key</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Generate a new key value while keeping the same permissions and settings.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Already Revoked */}
          {!action && !isEnabled && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                This API key has already been revoked and is no longer valid. 
                You can regenerate it to create a new key with the same permissions.
              </AlertDescription>
            </Alert>
          )}

          {/* Revocation Form */}
          {action === 'revoke' && (
            <div className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Warning:</strong> Revoking this API key will immediately disable all access. 
                  Any applications using this key will stop working immediately.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Revocation (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Security breach, key compromised, no longer needed..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm"
                  checked={confirmUnderstanding}
                  onCheckedChange={setConfirmUnderstanding}
                />
                <Label htmlFor="confirm" className="text-sm">
                  I understand that this action cannot be undone and will immediately disable the API key.
                </Label>
              </div>
            </div>
          )}

          {/* Regeneration Form */}
          {action === 'regenerate' && (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Note:</strong> Regenerating will create a new key value and immediately 
                  invalidate the old one. You'll need to update your applications with the new key.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Regeneration (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Routine key rotation, suspected compromise, security policy..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm"
                  checked={confirmUnderstanding}
                  onCheckedChange={setConfirmUnderstanding}
                />
                <Label htmlFor="confirm" className="text-sm">
                  I understand that the old key will be immediately invalidated and I'll need to update my applications.
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={action ? () => setAction(null) : handleClose}>
              {action ? 'Back' : 'Cancel'}
            </Button>
            
            {action && (
              <Button
                onClick={handleAction}
                disabled={!confirmUnderstanding || isProcessing}
                variant={action === 'revoke' ? 'destructive' : 'default'}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    {action === 'revoke' ? (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke Key
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Regenerate Key
                      </>
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/**
 * Secure API Key Display Component
 * Shows the full API key only once with copy functionality and security warnings
 */

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Eye, EyeOff, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ApiKeySecureDisplayProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
  expirationMinutes?: number; // How long the key is visible
}

export const ApiKeySecureDisplay: React.FC<ApiKeySecureDisplayProps> = ({
  open,
  onClose,
  apiKey,
  keyName,
  expirationMinutes = 15,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(expirationMinutes * 60);
  const [hasCopied, setHasCopied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  const handleRevealKey = () => {
    setIsVisible(true);
    setHasBeenViewed(true);
    
    // Auto-select the key for easy copying
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 100);

    toast({
      title: "API Key Revealed",
      description: "This is the only time you'll see the full key. Make sure to copy it now.",
      variant: "default",
    });
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setHasCopied(true);
      
      toast({
        title: "API Key Copied",
        description: "The API key has been copied to your clipboard.",
        variant: "default",
      });

      // Reset the copied state after 3 seconds
      setTimeout(() => setHasCopied(false), 3000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy the API key. Please select and copy manually.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDisplayValue = () => {
    if (isExpired) return '••••••••••••••••••••••••••••••••••••••••••••••••••••';
    if (!isVisible) return '••••••••••••••••••••••••••••••••••••••••••••••••••••';
    return apiKey;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-600" />
            <span>API Key Created Successfully</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Security Warning */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Important Security Notice:</strong> This is the only time you'll see the complete API key. 
              Make sure to copy and store it securely. We cannot recover it if lost.
            </AlertDescription>
          </Alert>

          {/* Key Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>API Key: {keyName}</span>
                <div className="flex items-center space-x-2">
                  {!isExpired && (
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(timeRemaining)}</span>
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive">Expired</Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="flex items-center space-x-2">
                    {!isExpired && !isVisible && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRevealKey}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Reveal Key</span>
                      </Button>
                    )}
                    {isVisible && !isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsVisible(false)}
                        className="flex items-center space-x-1"
                      >
                        <EyeOff className="h-4 w-4" />
                        <span>Hide Key</span>
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Input
                    ref={inputRef}
                    value={getDisplayValue()}
                    readOnly
                    className={cn(
                      "font-mono text-sm",
                      isVisible && !isExpired ? "bg-green-50 border-green-200" : "bg-gray-50",
                      isExpired && "bg-red-50 border-red-200"
                    )}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyKey}
                    disabled={!isVisible || isExpired}
                    className="flex items-center space-x-1"
                  >
                    {hasCopied ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Usage Instructions</h4>
                <div className="bg-gray-50 p-3 rounded-md">
                  <code className="text-sm">
                    curl -H "Authorization: Bearer {isVisible && !isExpired ? apiKey : 'YOUR_API_KEY'}" \\<br />
                    &nbsp;&nbsp;&nbsp;&nbsp; https://your-gateway.com/v1/chat/completions
                  </code>
                </div>
              </div>

              {/* Security Best Practices */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Security Best Practices</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Store the API key in a secure location (e.g., environment variables)</li>
                  <li>• Never commit API keys to version control</li>
                  <li>• Rotate keys regularly for enhanced security</li>
                  <li>• Monitor usage and revoke if suspicious activity is detected</li>
                  <li>• Use different keys for different environments (dev, staging, prod)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Status Messages */}
          {hasBeenViewed && !isExpired && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Key has been revealed. Make sure to copy it before closing this dialog.
              </AlertDescription>
            </Alert>
          )}

          {isExpired && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                The viewing session has expired. The API key is still valid, but you can no longer view it here. 
                If you didn't copy it, you'll need to regenerate a new key.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            {!isExpired && (
              <>
                <Clock className="h-4 w-4" />
                <span>This dialog will auto-expire in {formatTime(timeRemaining)}</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!hasBeenViewed && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button 
              onClick={onClose}
              variant={hasBeenViewed || isExpired ? "default" : "destructive"}
            >
              {hasBeenViewed || isExpired ? "Done" : "Close Without Viewing"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
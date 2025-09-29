/**
 * PWA Install Prompt Component
 * Shows install and update prompts for the Progressive Web App
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePWA } from '@/lib/pwa';
import { 
  Download, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Trash2, 
  HardDrive,
  X 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const PWAInstallPrompt: React.FC = () => {
  const { 
    isInstallable, 
    isUpdateAvailable, 
    isOnline, 
    cacheSize,
    installApp, 
    updateApp, 
    clearCache,
    getCacheSize 
  } = usePWA();
  
  const { toast } = useToast();
  const [showInstallPrompt, setShowInstallPrompt] = React.useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  // Show install prompt when app becomes installable
  React.useEffect(() => {
    if (isInstallable) {
      setShowInstallPrompt(true);
    }
  }, [isInstallable]);

  // Show update prompt when update is available
  React.useEffect(() => {
    if (isUpdateAvailable) {
      setShowUpdatePrompt(true);
    }
  }, [isUpdateAvailable]);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await installApp();
      if (success) {
        toast({
          title: "App Installed",
          description: "Dyad Admin has been installed on your device.",
        });
        setShowInstallPrompt(false);
      } else {
        toast({
          title: "Installation Cancelled",
          description: "App installation was cancelled.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Installation Failed",
        description: "Failed to install the app. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateApp();
      toast({
        title: "App Updated",
        description: "The app has been updated to the latest version.",
      });
      setShowUpdatePrompt(false);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update the app. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await clearCache();
      await getCacheSize();
      toast({
        title: "Cache Cleared",
        description: "App cache has been cleared successfully.",
      });
    } catch (error) {
      toast({
        title: "Clear Cache Failed",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Alert className={isOnline ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-orange-600" />
          )}
          <AlertDescription className={isOnline ? "text-green-800" : "text-orange-800"}>
            {isOnline ? "Online - All features available" : "Offline - Limited functionality"}
          </AlertDescription>
        </div>
      </Alert>

      {/* Install Prompt */}
      {showInstallPrompt && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">Install App</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstallPrompt(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-blue-700">
              Install Dyad Admin for faster access and offline functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                onClick={handleInstall} 
                disabled={isInstalling}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isInstalling ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Install
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowInstallPrompt(false)}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Maybe Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-900">Update Available</CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  New Version
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUpdatePrompt(false)}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-green-700">
              A new version of the app is available with improvements and bug fixes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate} 
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Now
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowUpdatePrompt(false)}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-gray-600" />
            <CardTitle>Storage Management</CardTitle>
          </div>
          <CardDescription>
            Manage app cache and offline data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Size:</span>
              <Badge variant="outline">{formatBytes(cacheSize)}</Badge>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearCache}
              disabled={isClearing}
              className="w-full"
            >
              {isClearing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Cache
                </>
              )}
            </Button>
            
            <p className="text-xs text-gray-500">
              Clearing cache will remove offline data and may require re-downloading resources.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
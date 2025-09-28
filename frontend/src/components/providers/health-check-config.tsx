/**
 * Health check configuration component for automated provider monitoring
 */

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Heart, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Settings,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  useConfigureHealthCheck, 
  useHealthHistory 
} from '@/hooks/api/use-providers';
import { 
  Provider, 
  HealthCheckConfig, 
  ProviderHealthHistory 
} from '@/types';
import { cn } from '@/lib/utils';

interface HealthCheckConfigProps {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultConfig: HealthCheckConfig = {
  enabled: true,
  interval: 15, // minutes
  timeout: 30, // seconds
  retryAttempts: 3,
  alertThreshold: 3, // consecutive failures
};

export const HealthCheckConfig: React.FC<HealthCheckConfigProps> = ({
  provider,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<HealthCheckConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const configureHealthCheckMutation = useConfigureHealthCheck();
  const { data: healthHistory, isLoading: isLoadingHistory } = useHealthHistory(
    provider.id, 
    { hours: 24 }
  );

  // Load existing configuration (in a real app, this would come from the provider data)
  useEffect(() => {
    // For now, we'll use default config. In a real implementation,
    // this would be loaded from the provider's health check configuration
    setConfig(defaultConfig);
    setHasChanges(false);
  }, [provider.id]);

  const handleConfigChange = (updates: Partial<HealthCheckConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await configureHealthCheckMutation.mutateAsync({
        providerId: provider.id,
        config,
      });

      toast({
        title: 'Health check configured',
        description: 'Health check settings have been updated successfully',
      });

      setHasChanges(false);
    } catch (error) {
      toast({
        title: 'Failed to configure health check',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const calculateUptime = () => {
    if (!healthHistory?.checks || healthHistory.checks.length === 0) {
      return 0;
    }

    const successfulChecks = healthHistory.checks.filter(
      check => check.status === 'healthy'
    ).length;
    
    return (successfulChecks / healthHistory.checks.length) * 100;
  };

  const getRecentStatus = () => {
    if (!healthHistory?.checks || healthHistory.checks.length === 0) {
      return 'unknown';
    }

    return healthHistory.checks[0].status;
  };

  const getConsecutiveFailures = () => {
    if (!healthHistory?.checks || healthHistory.checks.length === 0) {
      return 0;
    }

    let failures = 0;
    for (const check of healthHistory.checks) {
      if (check.status === 'unhealthy') {
        failures++;
      } else {
        break;
      }
    }
    return failures;
  };

  const uptime = calculateUptime();
  const recentStatus = getRecentStatus();
  const consecutiveFailures = getConsecutiveFailures();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Health Check Configuration: {provider.name}
          </DialogTitle>
          <DialogDescription>
            Configure automated health monitoring and alerting for this provider
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Health Check Settings
                </CardTitle>
                <CardDescription>
                  Configure how often and how the provider should be monitored
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled">Enable Health Checks</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically monitor provider health
                    </p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => 
                      handleConfigChange({ enabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="interval">Check Interval (minutes)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={config.interval}
                    onChange={(e) => 
                      handleConfigChange({ interval: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={1440}
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to check provider health (1-1440 minutes)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={config.timeout}
                    onChange={(e) => 
                      handleConfigChange({ timeout: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={300}
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time to wait for health check response
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryAttempts">Retry Attempts</Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    value={config.retryAttempts}
                    onChange={(e) => 
                      handleConfigChange({ retryAttempts: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={10}
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of retry attempts before marking as unhealthy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alertThreshold">Alert Threshold</Label>
                  <Input
                    id="alertThreshold"
                    type="number"
                    value={config.alertThreshold}
                    onChange={(e) => 
                      handleConfigChange({ alertThreshold: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={20}
                    disabled={!config.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Consecutive failures before triggering alerts
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || configureHealthCheckMutation.isPending}
              >
                {configureHealthCheckMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Status and History Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Health Status Overview
                </CardTitle>
                <CardDescription>
                  Current health status and recent performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {recentStatus === 'healthy' ? (
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      ) : recentStatus === 'unhealthy' ? (
                        <XCircle className="h-8 w-8 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <Badge 
                      variant={
                        recentStatus === 'healthy' ? 'default' : 
                        recentStatus === 'unhealthy' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {recentStatus}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      {uptime.toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">24h Uptime</p>
                  </div>
                </div>

                {consecutiveFailures > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {consecutiveFailures} consecutive failures detected
                      {consecutiveFailures >= config.alertThreshold && 
                        " - Alert threshold reached!"
                      }
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Checks (24h):</span>
                    <span>{healthHistory?.checks?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Successful:</span>
                    <span className="text-green-600">
                      {healthHistory?.checks?.filter(c => c.status === 'healthy').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Failed:</span>
                    <span className="text-red-600">
                      {healthHistory?.checks?.filter(c => c.status === 'unhealthy').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Response Time:</span>
                    <span>
                      {healthHistory?.checks && healthHistory.checks.length > 0
                        ? Math.round(
                            healthHistory.checks.reduce((sum, check) => sum + check.duration, 0) / 
                            healthHistory.checks.length
                          )
                        : 0
                      }ms
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Health Checks
                </CardTitle>
                <CardDescription>
                  Last 20 health check results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </div>
                ) : healthHistory?.checks && healthHistory.checks.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {healthHistory.checks.slice(0, 20).map((check, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <div className="flex items-center gap-2">
                            {check.status === 'healthy' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">
                              {new Date(check.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={check.status === 'healthy' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {check.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {check.duration}ms
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No health check history available
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HealthCheckConfig;
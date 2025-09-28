/**
 * API Key Detail Component
 * Shows detailed information about an API key including usage analytics and audit logs
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Key, 
  Shield, 
  Activity, 
  Clock, 
  BarChart3, 
  FileText, 
  Settings, 
  AlertTriangle,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { useApiKey, useApiKeyUsage } from '@/hooks/api/use-api-keys';
import { ApiKey } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { ApiKeyUsageChart } from './api-key-usage-chart';
import { ApiKeyUsageAnalytics } from './api-key-usage-analytics';

interface ApiKeyDetailProps {
  keyId: string;
  open: boolean;
  onClose: () => void;
  onUpdate?: (key: ApiKey) => void;
}

export const ApiKeyDetail: React.FC<ApiKeyDetailProps> = ({
  keyId,
  open,
  onClose,
  onUpdate,
}) => {
  const [timeRange, setTimeRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
  });

  const { data: apiKey, isLoading, error } = useApiKey(keyId, open);
  const { data: usage } = useApiKeyUsage(keyId, timeRange, open);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !apiKey) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Alert className="max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load API key details. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isEnabled = apiKey.enabled;
  const lastUsed = apiKey.lastUsed ? new Date(apiKey.lastUsed) : null;
  const createdAt = new Date(apiKey.createdAt);

  const getUsageStatus = () => {
    const requestsUsage = (apiKey.usage.requestsToday / (apiKey.rateLimits.requestsPerMinute * 24 * 60)) * 100;
    const tokensUsage = (apiKey.usage.tokensToday / (apiKey.rateLimits.tokensPerMinute * 24 * 60)) * 100;
    const maxUsage = Math.max(requestsUsage, tokensUsage);

    if (maxUsage > 90) return { status: 'high', color: 'text-red-600', bg: 'bg-red-50' };
    if (maxUsage > 70) return { status: 'medium', color: 'text-amber-600', bg: 'bg-amber-50' };
    if (maxUsage > 0) return { status: 'low', color: 'text-green-600', bg: 'bg-green-50' };
    return { status: 'none', color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  const usageStatus = getUsageStatus();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>{apiKey.name}</span>
              <Badge variant={isEnabled ? "default" : "destructive"}>
                {isEnabled ? "Active" : "Revoked"}
              </Badge>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isEnabled ? "Active" : "Revoked"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(createdAt, { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usage Today</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {apiKey.usage.requestsToday}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {apiKey.usage.tokensToday.toLocaleString()} tokens
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Used</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {lastUsed ? formatDistanceToNow(lastUsed, { addSuffix: true }) : "Never"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastUsed ? format(lastUsed, 'PPp') : 'No usage recorded'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Key Details */}
            <Card>
              <CardHeader>
                <CardTitle>Key Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Key Prefix</label>
                    <p className="text-sm text-muted-foreground font-mono">{apiKey.keyPrefix}***</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Permissions</label>
                    <p className="text-sm text-muted-foreground">{apiKey.permissions.length} permissions</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium">Rate Limits</label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm">Requests per Minute</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${usageStatus.color.replace('text-', 'bg-').replace('-600', '-400')}`}
                            style={{ 
                              width: `${Math.min((apiKey.usage.requestsToday / (apiKey.rateLimits.requestsPerMinute * 24 * 60)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {apiKey.rateLimits.requestsPerMinute}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm">Tokens per Minute</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${usageStatus.color.replace('text-', 'bg-').replace('-600', '-400')}`}
                            style={{ 
                              width: `${Math.min((apiKey.usage.tokensToday / (apiKey.rateLimits.tokensPerMinute * 24 * 60)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {apiKey.rateLimits.tokensPerMinute.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Status Alert */}
            {usageStatus.status === 'high' && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  This API key is approaching its rate limits. Consider increasing limits or monitoring usage more closely.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <ApiKeyUsageAnalytics keyId={keyId} />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Permissions ({apiKey.permissions.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {apiKey.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="justify-start">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permission Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['read', 'write', 'admin'].map((category) => {
                    const categoryPermissions = apiKey.permissions.filter(p => 
                      p.includes(category) || 
                      (category === 'read' && (p.includes('list') || p.includes('get'))) ||
                      (category === 'write' && (p.includes('create') || p.includes('update') || p.includes('delete'))) ||
                      (category === 'admin' && p.includes('admin'))
                    );

                    if (categoryPermissions.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="capitalize">
                            {category} Access
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {categoryPermissions.length} permissions
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {categoryPermissions.map((permission) => (
                            <Badge key={permission} variant="secondary" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Audit Log</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Mock audit log entries - in real implementation, this would come from the API */}
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">API Key Created</p>
                          <span className="text-xs text-muted-foreground">
                            {format(createdAt, 'PPp')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          API key "{apiKey.name}" was created with {apiKey.permissions.length} permissions
                        </p>
                      </div>
                    </div>

                    {lastUsed && (
                      <div className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">Last API Usage</p>
                            <span className="text-xs text-muted-foreground">
                              {format(lastUsed, 'PPp')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            API key was used for chat completion request
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Complete audit logs are available in the system logs
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
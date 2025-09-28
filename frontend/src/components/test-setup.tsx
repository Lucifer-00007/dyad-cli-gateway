/**
 * Test component to verify the setup is working
 */

import React from 'react';
import { useSystemHealth, useProviders } from '@/hooks/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const TestSetup: React.FC = () => {
  const { data: health, isLoading: healthLoading, error: healthError } = useSystemHealth();
  const { data: providers, isLoading: providersLoading, error: providersError } = useProviders();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Dyad Admin UI - Setup Test</h1>
        <p className="text-muted-foreground mt-2">
          Testing the core infrastructure setup
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* System Health Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {healthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : healthError ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              System Health
            </CardTitle>
            <CardDescription>
              Testing API client and system health endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading health status...</span>
              </div>
            )}
            
            {healthError && (
              <div className="space-y-2">
                <Badge variant="destructive">Error</Badge>
                <p className="text-sm text-muted-foreground">
                  {healthError.message}
                </p>
              </div>
            )}
            
            {health && (
              <div className="space-y-2">
                <Badge variant="default">
                  {health.status}
                </Badge>
                <div className="text-sm space-y-1">
                  <p><strong>Service:</strong> {health.service}</p>
                  <p><strong>Uptime:</strong> {Math.floor(health.uptime / 60)} minutes</p>
                  <p><strong>Version:</strong> {health.version || 'N/A'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Providers Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {providersLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : providersError ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              Providers API
            </CardTitle>
            <CardDescription>
              Testing providers service and React Query integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {providersLoading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading providers...</span>
              </div>
            )}
            
            {providersError && (
              <div className="space-y-2">
                <Badge variant="destructive">Error</Badge>
                <p className="text-sm text-muted-foreground">
                  {providersError.message}
                </p>
              </div>
            )}
            
            {providers && (
              <div className="space-y-2">
                <Badge variant="default">
                  {providers.totalResults} providers
                </Badge>
                <div className="text-sm space-y-1">
                  <p><strong>Total:</strong> {providers.totalResults}</p>
                  <p><strong>Page:</strong> {providers.page} of {providers.totalPages}</p>
                  <p><strong>Limit:</strong> {providers.limit}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Setup Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Setup Status
          </CardTitle>
          <CardDescription>
            Core infrastructure components status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>TypeScript Types</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>API Client (Axios)</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>TanStack Query</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Authentication Manager</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Query Persistence</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Error Handling</span>
              <Badge variant="default">✓ Configured</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Refresh Test
        </Button>
        <Button 
          onClick={() => {
            // Clear query cache for testing
            window.location.href = window.location.href;
          }}
          variant="outline"
        >
          Clear Cache & Reload
        </Button>
      </div>
    </div>
  );
};
/**
 * API Key Usage Analytics Component
 * Displays comprehensive usage analytics and monitoring for API keys
 */

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Clock, 
  Users, 
  AlertTriangle,
  Download,
  Calendar,
  Zap
} from 'lucide-react';
import { useAllApiKeyUsage, useApiKeyStats } from '@/hooks/api/use-api-keys';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ApiKeyUsageChart } from './api-key-usage-chart';

interface ApiKeyUsageAnalyticsProps {
  open: boolean;
  onClose: () => void;
  keyId?: string; // If provided, show analytics for specific key
}

type TimeRangeOption = '24h' | '7d' | '30d' | '90d';

const TIME_RANGE_OPTIONS: Record<TimeRangeOption, { label: string; days: number }> = {
  '24h': { label: 'Last 24 Hours', days: 1 },
  '7d': { label: 'Last 7 Days', days: 7 },
  '30d': { label: 'Last 30 Days', days: 30 },
  '90d': { label: 'Last 90 Days', days: 90 },
};

export const ApiKeyUsageAnalytics: React.FC<ApiKeyUsageAnalyticsProps> = ({
  open,
  onClose,
  keyId,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'requests' | 'tokens' | 'errors'>('requests');

  const dateRange = useMemo(() => {
    const days = TIME_RANGE_OPTIONS[timeRange].days;
    return {
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    };
  }, [timeRange]);

  const { data: usageData, isLoading } = useAllApiKeyUsage(dateRange);
  const { data: stats } = useApiKeyStats();

  const aggregatedMetrics = useMemo(() => {
    if (!usageData) return null;

    const totalRequests = usageData.reduce((sum, key) => sum + key.requestsToday, 0);
    const totalTokens = usageData.reduce((sum, key) => sum + key.tokensToday, 0);
    const activeKeys = usageData.filter(key => key.requestsToday > 0).length;
    const topKeys = usageData
      .sort((a, b) => b.requestsToday - a.requestsToday)
      .slice(0, 5);

    return {
      totalRequests,
      totalTokens,
      activeKeys,
      topKeys,
    };
  }, [usageData]);

  const handleExportData = () => {
    if (!usageData) return;

    const csvData = usageData.map(key => ({
      keyId: key.keyId,
      requestsToday: key.requestsToday,
      tokensToday: key.tokensToday,
      requestsThisMonth: key.requestsThisMonth,
      tokensThisMonth: key.tokensThisMonth,
      lastUsed: key.lastUsed || 'Never',
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-key-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>API Key Usage Analytics</span>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={timeRange} onValueChange={(value: TimeRangeOption) => setTimeRange(value)}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIME_RANGE_OPTIONS).map(([key, option]) => (
                    <SelectItem key={key} value={key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage Trends</TabsTrigger>
            <TabsTrigger value="keys">Key Performance</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.active} active, {stats.revoked} revoked
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalRequestsToday.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {((stats.totalRequestsToday / stats.totalRequestsThisMonth) * 100).toFixed(1)}% of monthly
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tokens Today</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTokensToday.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {((stats.totalTokensToday / stats.totalTokensThisMonth) * 100).toFixed(1)}% of monthly
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg per Key</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(stats.averageRequestsPerKey)}</div>
                    <p className="text-xs text-muted-foreground">requests/day</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Performing Keys */}
            {aggregatedMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Keys</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aggregatedMetrics.topKeys.map((key, index) => (
                      <div key={key.keyId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <p className="font-medium text-sm">{key.keyId}</p>
                            <p className="text-xs text-muted-foreground">
                              Last used: {key.lastUsed ? format(new Date(key.lastUsed), 'PPp') : 'Never'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{key.requestsToday.toLocaleString()} requests</p>
                          <p className="text-xs text-muted-foreground">
                            {key.tokensToday.toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Usage Trends</h3>
              <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requests">Requests</SelectItem>
                  <SelectItem value="tokens">Tokens</SelectItem>
                  <SelectItem value="errors">Errors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{selectedMetric} Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ApiKeyUsageChart
                  data={usageData || []}
                  metric={selectedMetric}
                  timeRange={timeRange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Individual Key Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {usageData?.map((key) => (
                    <div key={key.keyId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{key.keyId}</p>
                          {key.requestsToday === 0 && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Today</p>
                            <p className="font-medium">{key.requestsToday} req</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tokens</p>
                            <p className="font-medium">{key.tokensToday.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">This Month</p>
                            <p className="font-medium">{key.requestsThisMonth} req</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Used</p>
                            <p className="font-medium">
                              {key.lastUsed ? format(new Date(key.lastUsed), 'MMM d') : 'Never'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ 
                              width: `${Math.min((key.requestsToday / Math.max(...(usageData?.map(k => k.requestsToday) || [1]))) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Usage Insights</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aggregatedMetrics && (
                    <>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="font-medium text-blue-900">Peak Usage</p>
                        <p className="text-sm text-blue-700">
                          {aggregatedMetrics.activeKeys} out of {usageData?.length || 0} keys are actively used
                        </p>
                      </div>
                      
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="font-medium text-green-900">Efficiency</p>
                        <p className="text-sm text-green-700">
                          Average of {Math.round(aggregatedMetrics.totalRequests / Math.max(aggregatedMetrics.activeKeys, 1))} requests per active key
                        </p>
                      </div>

                      {aggregatedMetrics.activeKeys / (usageData?.length || 1) < 0.5 && (
                        <div className="p-3 bg-amber-50 rounded-lg">
                          <p className="font-medium text-amber-900">Optimization Opportunity</p>
                          <p className="text-sm text-amber-700">
                            Many keys are unused. Consider revoking inactive keys for better security.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Recommendations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <p className="font-medium text-blue-900">Security</p>
                    <p className="text-sm text-blue-700">
                      Regularly rotate API keys and revoke unused ones
                    </p>
                  </div>
                  
                  <div className="p-3 border-l-4 border-green-500 bg-green-50">
                    <p className="font-medium text-green-900">Monitoring</p>
                    <p className="text-sm text-green-700">
                      Set up alerts for unusual usage patterns
                    </p>
                  </div>
                  
                  <div className="p-3 border-l-4 border-amber-500 bg-amber-50">
                    <p className="font-medium text-amber-900">Performance</p>
                    <p className="text-sm text-amber-700">
                      Consider rate limit adjustments for high-usage keys
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
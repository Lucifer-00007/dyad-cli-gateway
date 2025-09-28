/**
 * Error tracking and analysis component
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

import { ErrorAnalysis, MonitoringTimeRange } from '../types';
import { toast } from 'sonner';

interface ErrorTrackingProps {
  errors: unknown[];
  timeRange: MonitoringTimeRange;
  isLoading: boolean;
}

const ERROR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'];

export const ErrorTracking: React.FC<ErrorTrackingProps> = ({
  errors,
  timeRange,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedErrorType, setSelectedErrorType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'count' | 'percentage' | 'recent'>('count');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const filteredErrors = useMemo(() => {
    let filtered = errors;

    if (searchTerm) {
      filtered = filtered.filter(error => 
        error.errorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        error.errorCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedErrorType !== 'all') {
      filtered = filtered.filter(error => error.errorType === selectedErrorType);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'count':
          return b.count - a.count;
        case 'percentage':
          return b.percentage - a.percentage;
        case 'recent':
          return new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime();
        default:
          return 0;
      }
    });
  }, [errors, searchTerm, selectedErrorType, sortBy]);

  const errorTypeDistribution = useMemo(() => {
    const distribution = errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .map(([type, count], index) => ({
        name: type,
        value: count,
        color: ERROR_COLORS[index % ERROR_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [errors]);

  const errorTrendData = useMemo(() => {
    // This would typically come from a time-series API
    // For now, we'll simulate trend data
    const now = new Date();
    const data = [];
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const totalErrors = errors.reduce((sum, error) => sum + error.count, 0);
      const hourlyErrors = Math.floor(totalErrors / 24 + Math.random() * 10);
      
      data.push({
        timestamp: timestamp.getTime(),
        errors: hourlyErrors,
        formattedTime: format(timestamp, 'HH:mm'),
      });
    }
    
    return data;
  }, [errors]);

  const topAffectedProviders = useMemo(() => {
    const providerErrors = errors.reduce((acc, error) => {
      error.affectedProviders.forEach(providerId => {
        acc[providerId] = (acc[providerId] || 0) + error.count;
      });
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(providerErrors)
      .map(([providerId, count]) => ({ providerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [errors]);

  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const copyErrorDetails = (error: unknown) => {
    const details = `Error Type: ${error.errorType}
Error Code: ${error.errorCode}
Count: ${error.count}
Percentage: ${error.percentage}%
Last Occurrence: ${error.lastOccurrence}
Affected Providers: ${error.affectedProviders.join(', ')}`;

    navigator.clipboard.writeText(details);
    toast.success('Error details copied to clipboard');
  };

  const exportErrors = () => {
    const csvContent = [
      'Error Type,Error Code,Count,Percentage,Last Occurrence,Affected Providers',
      ...filteredErrors.map(error => [
        error.errorType,
        error.errorCode,
        error.count,
        error.percentage,
        error.lastOccurrence,
        error.affectedProviders.join(';'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-analysis-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (percentage: number) => {
    if (percentage > 10) return 'text-red-600';
    if (percentage > 5) return 'text-orange-600';
    if (percentage > 1) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errors.reduce((sum, error) => sum + error.count, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {errors.length} error types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errors.reduce((sum, error) => sum + error.percentage, 0).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of total requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Common</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {errors[0]?.errorType || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {errors[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Affected Providers</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(errors.flatMap(error => error.affectedProviders)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique providers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Analysis Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Error Details</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="providers">Affected Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Error Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Error Distribution by Type</CardTitle>
                <CardDescription>
                  Breakdown of errors by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={errorTypeDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {errorTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Error Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Error Trend (24h)</CardTitle>
                <CardDescription>
                  Error occurrences over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={errorTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="formattedTime"
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(label) => `Time: ${label}`}
                        formatter={(value: number) => [value, 'Errors']}
                      />
                      <Line
                        type="monotone"
                        dataKey="errors"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Error Details</span>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={exportErrors}>
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search errors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <Select value={selectedErrorType} onValueChange={setSelectedErrorType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Array.from(new Set(errors.map(e => e.errorType))).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: unknown) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">By Count</SelectItem>
                    <SelectItem value="percentage">By Percentage</SelectItem>
                    <SelectItem value="recent">Most Recent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredErrors.map((error) => (
                    <Collapsible key={`${error.errorType}-${error.errorCode}`}>
                      <CollapsibleTrigger
                        className="w-full"
                        onClick={() => toggleErrorExpansion(`${error.errorType}-${error.errorCode}`)}
                      >
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center space-x-3">
                            {expandedErrors.has(`${error.errorType}-${error.errorCode}`) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            
                            <div className="text-left">
                              <div className="font-medium">{error.errorType}</div>
                              <div className="text-sm text-muted-foreground">{error.errorCode}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className={`font-medium ${getSeverityColor(error.percentage)}`}>
                                {error.count.toLocaleString()} ({error.percentage.toFixed(2)}%)
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(error.lastOccurrence), 'MMM dd, HH:mm')}
                              </div>
                            </div>

                            {getTrendIcon(error.trend)}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyErrorDetails(error);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Affected Providers:</span>
                              <div className="mt-1 space-y-1">
                                {error.affectedProviders.map((providerId: string) => (
                                  <Badge key={providerId} variant="outline">
                                    {providerId}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium">Trend:</span>
                              <div className="mt-1 flex items-center space-x-2">
                                {getTrendIcon(error.trend)}
                                <span className="capitalize">{error.trend}</span>
                              </div>
                            </div>
                          </div>

                          {error.samples && error.samples.length > 0 && (
                            <div>
                              <span className="font-medium text-sm">Recent Samples:</span>
                              <div className="mt-2 space-y-2">
                                {error.samples.slice(0, 3).map((sample: unknown, index: number) => (
                                  <div key={index} className="p-2 bg-muted rounded text-xs font-mono">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-muted-foreground">
                                        {format(new Date(sample.timestamp), 'MMM dd, HH:mm:ss')}
                                      </span>
                                      {sample.requestId && (
                                        <Badge variant="outline" className="text-xs">
                                          {sample.requestId.slice(0, 8)}
                                        </Badge>
                                      )}
                                    </div>
                                    <div>{sample.message}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Trends Analysis</CardTitle>
              <CardDescription>
                Historical error patterns and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={errorTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="formattedTime" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="errors" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Most Affected Providers</CardTitle>
              <CardDescription>
                Providers with the highest error counts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topAffectedProviders.map((provider, index) => (
                  <div key={provider.providerId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{provider.providerId}</div>
                        <div className="text-sm text-muted-foreground">
                          Provider ID
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-medium">{provider.count.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">errors</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
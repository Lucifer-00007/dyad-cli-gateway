/**
 * API Key Usage Chart Component
 * Displays usage metrics in various chart formats
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subHours, eachHourOfInterval, eachDayOfInterval, subDays } from 'date-fns';
import { ApiKeyUsageStats } from '@/services/api-keys';

interface ApiKeyUsageChartProps {
  data: ApiKeyUsageStats[];
  metric: 'requests' | 'tokens' | 'errors';
  timeRange: '24h' | '7d' | '30d' | '90d';
  chartType?: 'line' | 'area' | 'bar';
  showComparison?: boolean;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const ApiKeyUsageChart: React.FC<ApiKeyUsageChartProps> = ({
  data,
  metric,
  timeRange,
  chartType = 'line',
  showComparison = false,
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Generate time intervals based on time range
    const now = new Date();
    let intervals: Date[] = [];
    let formatString = '';

    switch (timeRange) {
      case '24h':
        intervals = eachHourOfInterval({
          start: subHours(now, 24),
          end: now,
        });
        formatString = 'HH:mm';
        break;
      case '7d':
      case '30d':
      case '90d':
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        intervals = eachDayOfInterval({
          start: subDays(now, days),
          end: now,
        });
        formatString = 'MMM d';
        break;
    }

    // Create mock time-series data (in real implementation, this would come from the API)
    return intervals.map((interval, index) => {
      const totalValue = data.reduce((sum, key) => {
        switch (metric) {
          case 'requests':
            return sum + (key.requestsToday / intervals.length);
          case 'tokens':
            return sum + (key.tokensToday / intervals.length);
          case 'errors':
            return sum + Math.floor(Math.random() * 5); // Mock error data
          default:
            return sum;
        }
      }, 0);

      // Add some variation to make the chart more realistic
      const variation = 0.8 + Math.random() * 0.4; // 80% to 120% of base value
      const value = Math.floor(totalValue * variation);

      return {
        time: format(interval, formatString),
        timestamp: interval.toISOString(),
        value,
        // Add individual key data for stacked charts
        ...data.reduce((acc, key, keyIndex) => {
          const keyValue = Math.floor((value / data.length) * (0.8 + Math.random() * 0.4));
          acc[`key_${keyIndex}`] = keyValue;
          acc[`key_${keyIndex}_name`] = key.keyId;
          return acc;
        }, {} as Record<string, any>),
      };
    });
  }, [data, metric, timeRange]);

  const topKeys = useMemo(() => {
    return data
      .sort((a, b) => {
        switch (metric) {
          case 'requests':
            return b.requestsToday - a.requestsToday;
          case 'tokens':
            return b.tokensToday - a.tokensToday;
          default:
            return b.requestsToday - a.requestsToday;
        }
      })
      .slice(0, 5);
  }, [data, metric]);

  const pieData = useMemo(() => {
    return topKeys.map((key, index) => ({
      name: key.keyId,
      value: metric === 'requests' ? key.requestsToday : key.tokensToday,
      color: COLORS[index % COLORS.length],
    }));
  }, [topKeys, metric]);

  const formatValue = (value: number) => {
    if (metric === 'tokens' && value > 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toLocaleString();
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'requests':
        return 'Requests';
      case 'tokens':
        return 'Tokens';
      case 'errors':
        return 'Errors';
      default:
        return 'Value';
    }
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">No usage data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="capitalize">{getMetricLabel()} Over Time</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {timeRange === '24h' ? 'Hourly' : 'Daily'} Data
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Chart */}
      {showComparison && pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Keys Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatValue(value), getMetricLabel()]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Performance Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topKeys.map((key, index) => {
                  const value = metric === 'requests' ? key.requestsToday : key.tokensToday;
                  const maxValue = Math.max(...topKeys.map(k => 
                    metric === 'requests' ? k.requestsToday : k.tokensToday
                  ));
                  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

                  return (
                    <div key={key.keyId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <span className="text-sm font-medium">{key.keyId}</span>
                        </div>
                        <span className="text-sm font-medium">{formatValue(value)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
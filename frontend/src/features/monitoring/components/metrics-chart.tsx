/**
 * Metrics chart component using Recharts
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
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import { format } from 'date-fns';
import { MetricDataPoint, MonitoringTimeRange } from '../types';

interface MetricsChartProps {
  title: string;
  data: MetricDataPoint[];
  type: 'requests' | 'errors' | 'latency' | 'tokens';
  timeRange: MonitoringTimeRange;
  chartType?: 'line' | 'area' | 'bar';
  showTrend?: boolean;
  onExport?: () => void;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  title,
  data,
  type,
  timeRange,
  chartType = 'line',
  showTrend = true,
  onExport,
}) => {
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp).getTime(),
      formattedTime: format(new Date(point.timestamp), 'MMM dd, HH:mm'),
    }));
  }, [data]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const recent = chartData.slice(-Math.min(5, chartData.length));
    const older = chartData.slice(0, Math.min(5, chartData.length));
    
    const recentAvg = recent.reduce((sum, point) => sum + point.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, point) => sum + point.value, 0) / older.length;
    
    if (olderAvg === 0) return { direction: 'stable', percentage: 0 };
    
    const percentage = ((recentAvg - olderAvg) / olderAvg) * 100;
    const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';
    
    return { direction, percentage: Math.abs(percentage) };
  }, [chartData]);

  const formatValue = (value: number) => {
    switch (type) {
      case 'requests':
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
      case 'errors':
        return `${value.toFixed(2)}%`;
      case 'latency':
        if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
        return `${value.toFixed(0)}ms`;
      case 'tokens':
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getColor = () => {
    switch (type) {
      case 'requests': return '#3b82f6'; // blue
      case 'errors': return '#ef4444'; // red
      case 'latency': return '#f59e0b'; // amber
      case 'tokens': return '#10b981'; // emerald
      default: return '#6b7280'; // gray
    }
  };

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">
            {format(new Date(label), 'MMM dd, yyyy HH:mm')}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium" style={{ color: payload[0].color }}>
              {formatValue(payload[0].value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const color = getColor();

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              className="text-xs"
            />
            <YAxis 
              tickFormatter={formatValue}
              className="text-xs"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              className="text-xs"
            />
            <YAxis 
              tickFormatter={formatValue}
              className="text-xs"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        );

      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              className="text-xs"
            />
            <YAxis 
              tickFormatter={formatValue}
              className="text-xs"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        );
    }
  };

  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold">{formatValue(currentValue)}</span>
            {showTrend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon()}
                <span className="text-sm text-muted-foreground">
                  {trend.percentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select defaultValue={chartType}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>
          
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs text-muted-foreground">
          <span>
            {format(timeRange.start, 'MMM dd, HH:mm')} - {format(timeRange.end, 'MMM dd, HH:mm')}
          </span>
          <span>{chartData.length} data points</span>
        </div>
      </CardContent>
    </Card>
  );
};
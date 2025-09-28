/**
 * Logs viewer component with filtering and real-time streaming
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Filter, 
  Download, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

import { useSystemLogs } from '@/hooks/api/use-system';
import { MonitoringTimeRange, StreamingLogEntry, LogFilter } from '../types';
import { LogEntry } from '@/types';

interface LogsViewerProps {
  timeRange: MonitoringTimeRange;
  streamingLogs?: StreamingLogEntry[];
  isStreaming?: boolean;
  onToggleStreaming?: (enabled: boolean) => void;
}

const LOG_LEVELS = [
  { value: 'debug', label: 'Debug', color: 'bg-gray-500' },
  { value: 'info', label: 'Info', color: 'bg-blue-500' },
  { value: 'warn', label: 'Warning', color: 'bg-yellow-500' },
  { value: 'error', label: 'Error', color: 'bg-red-500' },
  { value: 'fatal', label: 'Fatal', color: 'bg-red-700' },
];

const LOG_SOURCES = [
  'gateway',
  'provider',
  'adapter',
  'auth',
  'metrics',
  'health',
];

export const LogsViewer: React.FC<LogsViewerProps> = ({
  timeRange,
  streamingLogs = [],
  isStreaming = false,
  onToggleStreaming,
}) => {
  const [filters, setFilters] = useState<LogFilter>({
    level: [],
    source: [],
    search: '',
    timeRange,
  });
  const [page, setPage] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch historical logs
  const { data: logsData, isLoading, refetch } = useSystemLogs({
    page,
    limit: 100,
    level: filters.level,
    source: filters.source,
    search: filters.search,
    timeRange: filters.timeRange,
  });

  // Combine historical and streaming logs
  const allLogs = useMemo(() => {
    const historical = logsData?.results || [];
    const streaming = streamingLogs || [];
    
    // Merge and sort by timestamp
    const combined = [...historical, ...streaming].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Remove duplicates based on ID
    const unique = combined.filter((log, index, arr) => 
      arr.findIndex(l => l.id === log.id) === index
    );
    
    return unique;
  }, [logsData?.results, streamingLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allLogs, autoScroll]);

  const handleFilterChange = (key: keyof LogFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const handleLevelToggle = (level: string) => {
    const currentLevels = filters.level || [];
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level];
    
    handleFilterChange('level', newLevels);
  };

  const handleSourceToggle = (source: string) => {
    const currentSources = filters.source || [];
    const newSources = currentSources.includes(source)
      ? currentSources.filter(s => s !== source)
      : [...currentSources, source];
    
    handleFilterChange('source', newSources);
  };

  const clearFilters = () => {
    setFilters({
      level: [],
      source: [],
      search: '',
      timeRange,
    });
    setPage(1);
  };

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Level,Source,Message,Provider ID,Request ID',
      ...allLogs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`,
        log.providerId || '',
        log.requestId || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <Bug className="w-3 h-3" />;
      case 'info': return <Info className="w-3 h-3" />;
      case 'warn': return <AlertTriangle className="w-3 h-3" />;
      case 'error': return <AlertCircle className="w-3 h-3" />;
      case 'fatal': return <Zap className="w-3 h-3" />;
      default: return <Info className="w-3 h-3" />;
    }
  };

  const getLevelColor = (level: string) => {
    const levelConfig = LOG_LEVELS.find(l => l.value === level);
    return levelConfig?.color || 'bg-gray-500';
  };

  const formatLogMessage = (log: LogEntry | StreamingLogEntry) => {
    // Basic sanitization - in production, use a proper sanitization library
    const sanitized = log.message
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    
    // Highlight search terms
    if (filters.search && sanitized.toLowerCase().includes(filters.search.toLowerCase())) {
      const regex = new RegExp(`(${filters.search})`, 'gi');
      return sanitized.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
    }
    
    return sanitized;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">System Logs</CardTitle>
            <CardDescription>
              Real-time and historical system logs with filtering
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={allLogs.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            {onToggleStreaming && (
              <Button
                variant={isStreaming ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleStreaming(!isStreaming)}
              >
                {isStreaming ? (
                  <Pause className="w-4 h-4 mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                {isStreaming ? 'Pause' : 'Stream'}
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Log Levels */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Log Levels</label>
                <div className="flex flex-wrap gap-2">
                  {LOG_LEVELS.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={level.value}
                        checked={filters.level?.includes(level.value)}
                        onCheckedChange={() => handleLevelToggle(level.value)}
                      />
                      <label
                        htmlFor={level.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Badge variant="outline" className="text-xs">
                          <div className={`w-2 h-2 rounded-full ${level.color} mr-1`} />
                          {level.label}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sources</label>
                <div className="flex flex-wrap gap-2">
                  {LOG_SOURCES.map((source) => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={source}
                        checked={filters.source?.includes(source)}
                        onCheckedChange={() => handleSourceToggle(source)}
                      />
                      <label
                        htmlFor={source}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Badge variant="outline" className="text-xs capitalize">
                          {source}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-scroll"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <label htmlFor="auto-scroll" className="text-sm">
                  Auto-scroll to new logs
                </label>
              </div>
              
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="p-4 space-y-1">
            {allLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isLoading ? 'Loading logs...' : 'No logs found'}
              </div>
            ) : (
              allLogs.map((log, index) => (
                <div
                  key={`${log.id}-${index}`}
                  className="flex items-start space-x-3 py-2 px-3 rounded-md hover:bg-muted/50 text-sm font-mono"
                >
                  {/* Timestamp */}
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                  </span>

                  {/* Level */}
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${getLevelColor(log.level)}`} />
                    <span className={`text-xs font-medium uppercase w-12 ${
                      log.level === 'error' || log.level === 'fatal' ? 'text-red-600' :
                      log.level === 'warn' ? 'text-yellow-600' :
                      log.level === 'info' ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>
                      {log.level}
                    </span>
                  </div>

                  {/* Source */}
                  <Badge variant="outline" className="text-xs">
                    {log.source}
                  </Badge>

                  {/* Provider ID */}
                  {log.providerId && (
                    <Badge variant="secondary" className="text-xs">
                      {log.providerId}
                    </Badge>
                  )}

                  {/* Message */}
                  <div 
                    className="flex-1 break-words"
                    dangerouslySetInnerHTML={{ __html: formatLogMessage(log) }}
                  />

                  {/* Request ID */}
                  {log.requestId && (
                    <span className="text-xs text-muted-foreground">
                      {log.requestId.slice(0, 8)}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-2 border-t bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>{allLogs.length} logs</span>
            {isStreaming && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live streaming</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {logsData && (
              <span>
                Page {logsData.page} of {logsData.totalPages}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
/**
 * Rate limiting indicators and quota management components
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, CheckCircle, XCircle, Zap, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rateLimitTracker } from '@/lib/security';

interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetTime: number;
  windowMs: number;
}

interface RateLimitIndicatorProps {
  status: RateLimitStatus;
  className?: string;
  showDetails?: boolean;
  variant?: 'compact' | 'detailed';
}

/**
 * Rate limit indicator component
 */
export const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({
  status,
  className,
  showDetails = false,
  variant = 'compact',
}) => {
  const [timeUntilReset, setTimeUntilReset] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, status.resetTime - now);
      setTimeUntilReset(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status.resetTime]);

  const usagePercentage = useMemo(() => {
    return ((status.limit - status.remaining) / status.limit) * 100;
  }, [status.limit, status.remaining]);

  const statusLevel = useMemo(() => {
    if (status.remaining === 0) return 'blocked';
    if (usagePercentage >= 90) return 'critical';
    if (usagePercentage >= 75) return 'warning';
    return 'normal';
  }, [usagePercentage, status.remaining]);

  const statusColor = useMemo(() => {
    switch (statusLevel) {
      case 'blocked':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'normal':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [statusLevel]);

  const formatTime = (ms: number): string => {
    if (ms < 1000) return '< 1s';
    if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.ceil(ms / 60000)}m`;
    return `${Math.ceil(ms / 3600000)}h`;
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <div className={cn('flex items-center gap-1 px-2 py-1 rounded border', statusColor)}>
          {statusLevel === 'blocked' ? (
            <XCircle className="h-3 w-3" />
          ) : statusLevel === 'critical' || statusLevel === 'warning' ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
          <span className="font-medium">
            {status.remaining}/{status.limit}
          </span>
        </div>
        {timeUntilReset > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Timer className="h-3 w-3" />
            <span>{formatTime(timeUntilReset)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('rate-limit-card', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Rate Limit Status</CardTitle>
          <Badge variant={statusLevel === 'normal' ? 'default' : 'destructive'}>
            {statusLevel === 'blocked' ? 'Blocked' : 
             statusLevel === 'critical' ? 'Critical' : 
             statusLevel === 'warning' ? 'Warning' : 'Normal'}
          </Badge>
        </div>
        <CardDescription>
          {status.remaining} of {status.limit} requests remaining
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Usage</span>
            <span>{Math.round(usagePercentage)}%</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={cn(
              'h-2',
              statusLevel === 'critical' || statusLevel === 'blocked' ? 'bg-red-100' :
              statusLevel === 'warning' ? 'bg-yellow-100' : 'bg-green-100'
            )}
          />
        </div>

        {timeUntilReset > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>Resets in</span>
            </div>
            <span className="font-medium">{formatTime(timeUntilReset)}</span>
          </div>
        )}

        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Window</span>
                <div className="font-medium">{formatTime(status.windowMs)}</div>
              </div>
              <div>
                <span className="text-gray-500">Limit</span>
                <div className="font-medium">{status.limit} requests</div>
              </div>
            </div>
          </div>
        )}

        {statusLevel === 'blocked' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rate limit exceeded</AlertTitle>
            <AlertDescription>
              You have exceeded the rate limit. Please wait {formatTime(timeUntilReset)} before making more requests.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Quota management component
 */
interface QuotaStatus {
  used: number;
  limit: number;
  period: 'hour' | 'day' | 'month';
  resetTime: number;
}

interface QuotaManagerProps {
  quotas: {
    requests: QuotaStatus;
    tokens?: QuotaStatus;
    storage?: QuotaStatus;
  };
  className?: string;
  showUpgradeOption?: boolean;
  onUpgrade?: () => void;
}

export const QuotaManager: React.FC<QuotaManagerProps> = ({
  quotas,
  className,
  showUpgradeOption = false,
  onUpgrade,
}) => {
  const getQuotaLevel = (quota: QuotaStatus): 'normal' | 'warning' | 'critical' | 'exceeded' => {
    const percentage = (quota.used / quota.limit) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const getQuotaColor = (level: string): string => {
    switch (level) {
      case 'exceeded':
        return 'text-red-600';
      case 'critical':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'normal':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatQuotaValue = (value: number, type: 'requests' | 'tokens' | 'storage'): string => {
    if (type === 'storage') {
      if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
      return `${value}B`;
    }
    if (type === 'tokens') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toString();
    }
    return value.toString();
  };

  const formatResetTime = (resetTime: number): string => {
    const now = Date.now();
    const diff = resetTime - now;
    
    if (diff < 0) return 'Now';
    if (diff < 60000) return `${Math.ceil(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.ceil(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.ceil(diff / 3600000)}h`;
    return `${Math.ceil(diff / 86400000)}d`;
  };

  return (
    <Card className={cn('quota-manager', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Usage Quotas</CardTitle>
          {showUpgradeOption && (
            <Button variant="outline" size="sm" onClick={onUpgrade}>
              <Zap className="mr-2 h-4 w-4" />
              Upgrade
            </Button>
          )}
        </div>
        <CardDescription>
          Monitor your API usage and quotas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Requests Quota */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">API Requests</h4>
            <Badge variant={getQuotaLevel(quotas.requests) === 'normal' ? 'default' : 'destructive'}>
              {getQuotaLevel(quotas.requests)}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used</span>
              <span className={getQuotaColor(getQuotaLevel(quotas.requests))}>
                {formatQuotaValue(quotas.requests.used, 'requests')} / {formatQuotaValue(quotas.requests.limit, 'requests')}
              </span>
            </div>
            <Progress 
              value={(quotas.requests.used / quotas.requests.limit) * 100}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Resets every {quotas.requests.period}</span>
              <span>in {formatResetTime(quotas.requests.resetTime)}</span>
            </div>
          </div>
        </div>

        {/* Tokens Quota */}
        {quotas.tokens && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Tokens</h4>
              <Badge variant={getQuotaLevel(quotas.tokens) === 'normal' ? 'default' : 'destructive'}>
                {getQuotaLevel(quotas.tokens)}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span className={getQuotaColor(getQuotaLevel(quotas.tokens))}>
                  {formatQuotaValue(quotas.tokens.used, 'tokens')} / {formatQuotaValue(quotas.tokens.limit, 'tokens')}
                </span>
              </div>
              <Progress 
                value={(quotas.tokens.used / quotas.tokens.limit) * 100}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Resets every {quotas.tokens.period}</span>
                <span>in {formatResetTime(quotas.tokens.resetTime)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Storage Quota */}
        {quotas.storage && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Storage</h4>
              <Badge variant={getQuotaLevel(quotas.storage) === 'normal' ? 'default' : 'destructive'}>
                {getQuotaLevel(quotas.storage)}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span className={getQuotaColor(getQuotaLevel(quotas.storage))}>
                  {formatQuotaValue(quotas.storage.used, 'storage')} / {formatQuotaValue(quotas.storage.limit, 'storage')}
                </span>
              </div>
              <Progress 
                value={(quotas.storage.used / quotas.storage.limit) * 100}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Resets every {quotas.storage.period}</span>
                <span>in {formatResetTime(quotas.storage.resetTime)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quota Warnings */}
        {Object.values(quotas).some(quota => getQuotaLevel(quota) === 'exceeded') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Quota Exceeded</AlertTitle>
            <AlertDescription>
              You have exceeded one or more quotas. Some features may be limited until the quota resets.
              {showUpgradeOption && (
                <>
                  {' '}
                  <Button variant="link" className="p-0 h-auto" onClick={onUpgrade}>
                    Upgrade your plan
                  </Button>
                  {' '}to increase your limits.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {Object.values(quotas).some(quota => getQuotaLevel(quota) === 'critical') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Quota Warning</AlertTitle>
            <AlertDescription>
              You are approaching your quota limits. Consider monitoring your usage more closely.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Real-time rate limit hook
 */
export const useRateLimit = (key: string, limit: number = 100, windowMs: number = 60000) => {
  const [status, setStatus] = useState<RateLimitStatus>({
    limit,
    remaining: limit,
    resetTime: Date.now() + windowMs,
    windowMs,
  });

  const checkRateLimit = useCallback((): boolean => {
    const isWithinLimit = rateLimitTracker.isWithinLimit(key);
    const remaining = rateLimitTracker.getRemainingRequests(key);
    const resetTime = Date.now() + rateLimitTracker.getResetTime(key);

    setStatus({
      limit,
      remaining,
      resetTime,
      windowMs,
    });

    return isWithinLimit;
  }, [key, limit, windowMs]);

  const recordRequest = (): void => {
    rateLimitTracker.recordRequest(key);
    checkRateLimit();
  };

  useEffect(() => {
    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, [checkRateLimit]);

  return {
    status,
    checkRateLimit,
    recordRequest,
    isWithinLimit: status.remaining > 0,
  };
};

/**
 * Rate limit wrapper component
 */
interface RateLimitWrapperProps {
  children: React.ReactNode;
  rateLimitKey: string;
  limit?: number;
  windowMs?: number;
  showIndicator?: boolean;
  onLimitExceeded?: () => void;
}

export const RateLimitWrapper: React.FC<RateLimitWrapperProps> = ({
  children,
  rateLimitKey,
  limit = 100,
  windowMs = 60000,
  showIndicator = true,
  onLimitExceeded,
}) => {
  const { status, isWithinLimit } = useRateLimit(rateLimitKey, limit, windowMs);

  useEffect(() => {
    if (!isWithinLimit && onLimitExceeded) {
      onLimitExceeded();
    }
  }, [isWithinLimit, onLimitExceeded]);

  return (
    <div className="rate-limit-wrapper">
      {showIndicator && (
        <div className="mb-4">
          <RateLimitIndicator status={status} variant="compact" />
        </div>
      )}
      <div className={cn('transition-opacity', !isWithinLimit && 'opacity-50 pointer-events-none')}>
        {children}
      </div>
    </div>
  );
};
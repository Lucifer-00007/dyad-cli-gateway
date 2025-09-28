/**
 * Feature gate component with graceful degradation and fallback UI
 */

import React from 'react';
import { useFeatureFlag } from '@/lib/feature-flags';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, Settings } from 'lucide-react';

export interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showFallbackMessage?: boolean;
  fallbackMessage?: string;
  onFallbackAction?: () => void;
  fallbackActionLabel?: string;
  gracefulDegradation?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showFallbackMessage = true,
  fallbackMessage,
  onFallbackAction,
  fallbackActionLabel = 'Learn More',
  gracefulDegradation = true,
}) => {
  const isEnabled = useFeatureFlag(feature);

  if (isEnabled) {
    return <>{children}</>;
  }

  // If feature is disabled, show fallback or graceful degradation
  if (fallback) {
    return <>{fallback}</>;
  }

  if (!gracefulDegradation) {
    return null;
  }

  // Default fallback UI
  return (
    <div className="p-4 border border-dashed rounded-lg bg-muted/20">
      {showFallbackMessage && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {fallbackMessage || `The ${feature} feature is currently unavailable.`}
            </span>
            {onFallbackAction && (
              <Button variant="outline" size="sm" onClick={onFallbackAction}>
                {fallbackActionLabel}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export interface ConditionalFeatureProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ConditionalFeature: React.FC<ConditionalFeatureProps> = ({
  feature,
  children,
  fallback = null,
}) => {
  const isEnabled = useFeatureFlag(feature);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

export interface FeatureBadgeProps {
  feature: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  showWhenDisabled?: boolean;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  feature,
  variant = 'secondary',
  showWhenDisabled = false,
}) => {
  const isEnabled = useFeatureFlag(feature);

  if (!isEnabled && !showWhenDisabled) {
    return null;
  }

  return (
    <Badge variant={isEnabled ? variant : 'outline'}>
      {isEnabled ? 'Enabled' : 'Disabled'}
    </Badge>
  );
};

export interface FeatureToggleProps {
  feature: string;
  onToggle?: (enabled: boolean) => void;
  disabled?: boolean;
  showStatus?: boolean;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  feature,
  onToggle,
  disabled = false,
  showStatus = true,
}) => {
  const isEnabled = useFeatureFlag(feature);

  const handleToggle = () => {
    if (!disabled) {
      onToggle?.(!isEnabled);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={isEnabled ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
      >
        <Settings className="h-3 w-3 mr-1" />
        {isEnabled ? 'Disable' : 'Enable'}
      </Button>
      {showStatus && (
        <FeatureBadge feature={feature} showWhenDisabled />
      )}
    </div>
  );
};

export interface ProgressiveFeatureProps {
  feature: string;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

export const ProgressiveFeature: React.FC<ProgressiveFeatureProps> = ({
  feature,
  children,
  loadingFallback,
  errorFallback,
  onError,
}) => {
  const isEnabled = useFeatureFlag(feature);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (isEnabled && !error) {
      setIsLoading(true);
      // Simulate feature loading/initialization
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, error]);

  if (!isEnabled) {
    return (
      <FeatureGate
        feature={feature}
        fallbackMessage={`${feature} is not available in your current plan.`}
      >
        {children}
      </FeatureGate>
    );
  }

  if (error) {
    return (
      <>
        {errorFallback || (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load {feature}. Please try again.
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                }}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        {loadingFallback || (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">
              Loading {feature}...
            </span>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

// Higher-order component for feature gating
export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: string,
  fallback?: React.ComponentType<P>
) {
  const FeatureGatedComponent = (props: P) => {
    const isEnabled = useFeatureFlag(feature);

    if (isEnabled) {
      return <WrappedComponent {...props} />;
    }

    if (fallback) {
      const FallbackComponent = fallback;
      return <FallbackComponent {...props} />;
    }

    return (
      <FeatureGate
        feature={feature}
        fallbackMessage={`This feature is currently unavailable.`}
      >
        <WrappedComponent {...props} />
      </FeatureGate>
    );
  };

  FeatureGatedComponent.displayName = `withFeatureGate(${WrappedComponent.displayName || WrappedComponent.name})`;

  return FeatureGatedComponent;
}

// Hook for conditional feature rendering
export const useConditionalFeature = (feature: string) => {
  const isEnabled = useFeatureFlag(feature);

  const renderWhenEnabled = React.useCallback(
    (component: React.ReactNode) => {
      return isEnabled ? component : null;
    },
    [isEnabled]
  );

  const renderWhenDisabled = React.useCallback(
    (component: React.ReactNode) => {
      return !isEnabled ? component : null;
    },
    [isEnabled]
  );

  return {
    isEnabled,
    renderWhenEnabled,
    renderWhenDisabled,
  };
};
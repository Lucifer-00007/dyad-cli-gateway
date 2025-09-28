/**
 * Feature gate component for conditional rendering based on feature flags
 */

import React, { ReactNode } from 'react';
import { useFeatureFlag } from '@/lib/feature-flags';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
  showFallbackMessage?: boolean;
  fallbackMessage?: string;
}

/**
 * Conditionally render children based on feature flag status
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  flag,
  children,
  fallback,
  showFallbackMessage = false,
  fallbackMessage,
}) => {
  const isEnabled = useFeatureFlag(flag);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showFallbackMessage) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {fallbackMessage || `This feature is currently unavailable.`}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

/**
 * Higher-order component for feature gating
 */
export function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  flag: string,
  fallback?: ReactNode
) {
  return function FeatureGatedComponent(props: P) {
    return (
      <FeatureGate flag={flag} fallback={fallback}>
        <Component {...props} />
      </FeatureGate>
    );
  };
}

/**
 * Hook for conditional feature rendering
 */
export const useConditionalFeature = (flag: string) => {
  const isEnabled = useFeatureFlag(flag);

  return {
    isEnabled,
    renderIf: (component: ReactNode) => (isEnabled ? component : null),
    renderElse: (component: ReactNode, fallback: ReactNode) =>
      isEnabled ? component : fallback,
  };
};
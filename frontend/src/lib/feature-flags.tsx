/**
 * Feature flag system with graceful degradation and fallback UI components
 */

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number;
  dependencies?: string[];
  fallbackComponent?: ReactNode;
}

export interface FeatureFlagsConfig {
  flags: Record<string, FeatureFlag>;
  userId?: string;
  environment: 'development' | 'staging' | 'production';
}

// Default feature flags configuration
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  'bulk-operations': {
    key: 'bulk-operations',
    enabled: true,
    description: 'Enable bulk operations for providers and API keys',
    rolloutPercentage: 100,
  },
  'advanced-filtering': {
    key: 'advanced-filtering',
    enabled: true,
    description: 'Enable advanced filtering and search capabilities',
    rolloutPercentage: 100,
  },
  'data-export': {
    key: 'data-export',
    enabled: true,
    description: 'Enable data export functionality (CSV, JSON)',
    rolloutPercentage: 100,
  },
  'virtual-scrolling': {
    key: 'virtual-scrolling',
    enabled: true,
    description: 'Enable virtual scrolling for large datasets',
    rolloutPercentage: 100,
  },
  'real-time-updates': {
    key: 'real-time-updates',
    enabled: true,
    description: 'Enable real-time updates via WebSocket',
    rolloutPercentage: 90,
  },
  'chat-playground': {
    key: 'chat-playground',
    enabled: false, // Not implemented yet
    description: 'Enable interactive chat playground',
    rolloutPercentage: 0,
  },
  'advanced-analytics': {
    key: 'advanced-analytics',
    enabled: false,
    description: 'Enable advanced analytics and reporting',
    rolloutPercentage: 50,
  },
  'provider-templates': {
    key: 'provider-templates',
    enabled: true,
    description: 'Enable provider configuration templates',
    rolloutPercentage: 100,
  },
  'batch-testing': {
    key: 'batch-testing',
    enabled: true,
    description: 'Enable batch testing capabilities',
    rolloutPercentage: 80,
  },
  'performance-monitoring': {
    key: 'performance-monitoring',
    enabled: true,
    description: 'Enable frontend performance monitoring',
    rolloutPercentage: 100,
  },
};

class FeatureFlagManager {
  private flags: Record<string, FeatureFlag> = { ...DEFAULT_FLAGS };
  private userId?: string;
  private environment: string = 'development';

  constructor(config?: Partial<FeatureFlagsConfig>) {
    if (config) {
      this.flags = { ...this.flags, ...config.flags };
      this.userId = config.userId;
      this.environment = config.environment || 'development';
    }

    // Load flags from localStorage if available
    this.loadFromStorage();
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagKey: string): boolean {
    const flag = this.flags[flagKey];
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found`);
      return false;
    }

    // Check dependencies
    if (flag.dependencies) {
      const dependenciesMet = flag.dependencies.every(dep => this.isEnabled(dep));
      if (!dependenciesMet) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(this.userId || 'anonymous', flagKey);
      const percentage = hash % 100;
      if (percentage >= flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.enabled;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  /**
   * Update a feature flag
   */
  updateFlag(flagKey: string, updates: Partial<FeatureFlag>): void {
    if (this.flags[flagKey]) {
      this.flags[flagKey] = { ...this.flags[flagKey], ...updates };
      this.saveToStorage();
    }
  }

  /**
   * Add a new feature flag
   */
  addFlag(flag: FeatureFlag): void {
    this.flags[flag.key] = flag;
    this.saveToStorage();
  }

  /**
   * Remove a feature flag
   */
  removeFlag(flagKey: string): void {
    delete this.flags[flagKey];
    this.saveToStorage();
  }

  /**
   * Load flags from remote configuration
   */
  async loadRemoteFlags(): Promise<void> {
    try {
      // In a real implementation, this would fetch from a feature flag service
      const response = await fetch('/api/v1/admin/feature-flags');
      if (response.ok) {
        const remoteFlags = await response.json();
        this.flags = { ...this.flags, ...remoteFlags };
        this.saveToStorage();
      }
    } catch (error) {
      console.warn('Failed to load remote feature flags:', error);
    }
  }

  /**
   * Simple hash function for consistent rollout
   */
  private hashUserId(userId: string, flagKey: string): number {
    const str = `${userId}-${flagKey}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Save flags to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem('dyad-feature-flags', JSON.stringify(this.flags));
    } catch (error) {
      console.warn('Failed to save feature flags to storage:', error);
    }
  }

  /**
   * Load flags from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('dyad-feature-flags');
      if (stored) {
        const storedFlags = JSON.parse(stored);
        this.flags = { ...this.flags, ...storedFlags };
      }
    } catch (error) {
      console.warn('Failed to load feature flags from storage:', error);
    }
  }
}

// React Context for feature flags
const FeatureFlagsContext = createContext<FeatureFlagManager | null>(null);

export interface FeatureFlagsProviderProps {
  children: ReactNode;
  config?: Partial<FeatureFlagsConfig>;
}

export const FeatureFlagsProvider: React.FC<FeatureFlagsProviderProps> = ({
  children,
  config,
}) => {
  const [manager] = useState(() => new FeatureFlagManager(config));

  useEffect(() => {
    // Load remote flags on mount
    manager.loadRemoteFlags();
  }, [manager]);

  return (
    <FeatureFlagsContext.Provider value={manager}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

/**
 * Hook to access feature flags
 */
export const useFeatureFlags = () => {
  const manager = useContext(FeatureFlagsContext);
  if (!manager) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }

  return {
    isEnabled: (flagKey: string) => manager.isEnabled(flagKey),
    getAllFlags: () => manager.getAllFlags(),
    updateFlag: (flagKey: string, updates: Partial<FeatureFlag>) =>
      manager.updateFlag(flagKey, updates),
    addFlag: (flag: FeatureFlag) => manager.addFlag(flag),
    removeFlag: (flagKey: string) => manager.removeFlag(flagKey),
  };
};

/**
 * Hook to check a specific feature flag
 */
export const useFeatureFlag = (flagKey: string) => {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagKey);
};

export { FeatureFlagManager };
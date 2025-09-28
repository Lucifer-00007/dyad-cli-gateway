/**
 * Security context provider for managing security state and policies
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SecurityAuditor, CSRFProtection, SecureStorage } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

interface SecurityState {
  csrfToken: string;
  isSecureConnection: boolean;
  securityLevel: 'low' | 'medium' | 'high';
  rateLimitStatus: {
    remaining: number;
    resetTime: number;
  };
  securityReport: {
    csrfEnabled: boolean;
    xssProtectionEnabled: boolean;
    httpsOnly: boolean;
    secureStorageUsed: boolean;
    rateLimitingEnabled: boolean;
  };
}

interface SecurityActions {
  refreshCSRFToken: () => void;
  reportSecurityIssue: (issue: string, severity: 'low' | 'medium' | 'high') => void;
  auditFormData: (data: Record<string, unknown>) => string[];
  clearSecureStorage: () => void;
  updateSecurityLevel: (level: 'low' | 'medium' | 'high') => void;
}

interface SecurityContextValue extends SecurityState, SecurityActions {}

const SecurityContext = createContext<SecurityContextValue | undefined>(undefined);

interface SecurityProviderProps {
  children: React.ReactNode;
  initialSecurityLevel?: 'low' | 'medium' | 'high';
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({
  children,
  initialSecurityLevel = 'medium',
}) => {
  const { toast } = useToast();
  const [securityState, setSecurityState] = useState<SecurityState>({
    csrfToken: '',
    isSecureConnection: location.protocol === 'https:',
    securityLevel: initialSecurityLevel,
    rateLimitStatus: {
      remaining: 100,
      resetTime: Date.now() + 60000,
    },
    securityReport: {
      csrfEnabled: false,
      xssProtectionEnabled: true,
      httpsOnly: location.protocol === 'https:',
      secureStorageUsed: true,
      rateLimitingEnabled: true,
    },
  });

  // Initialize security state
  useEffect(() => {
    const initializeSecurity = () => {
      const csrfToken = CSRFProtection.getToken();
      const securityReport = SecurityAuditor.generateSecurityReport();

      setSecurityState(prev => ({
        ...prev,
        csrfToken,
        securityReport,
      }));

      // Warn about insecure connections in production
      if (process.env.NODE_ENV === 'production' && !prev.isSecureConnection) {
        toast({
          title: 'Security Warning',
          description: 'This connection is not secure. Please use HTTPS.',
          variant: 'destructive',
        });
      }
    };

    initializeSecurity();
  }, [toast]);

  // Monitor security events
  useEffect(() => {
    const handleSecurityEvent = (event: CustomEvent) => {
      const { error } = event.detail;
      
      if (error.severity === 'critical') {
        toast({
          title: 'Critical Security Issue',
          description: error.userMessage,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('api-error', handleSecurityEvent as EventListener);
    return () => {
      window.removeEventListener('api-error', handleSecurityEvent as EventListener);
    };
  }, [toast]);

  // Security actions
  const refreshCSRFToken = useCallback(() => {
    const newToken = CSRFProtection.getToken();
    setSecurityState(prev => ({
      ...prev,
      csrfToken: newToken,
    }));
  }, []);

  const reportSecurityIssue = useCallback((issue: string, severity: 'low' | 'medium' | 'high') => {
    console.warn(`Security Issue (${severity}):`, issue);
    
    // Show toast for medium and high severity issues
    if (severity !== 'low') {
      toast({
        title: 'Security Issue Detected',
        description: issue,
        variant: severity === 'high' ? 'destructive' : 'default',
      });
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production' && window.Sentry) {
      window.Sentry.captureMessage(`Security Issue: ${issue}`, severity);
    }
  }, [toast]);

  const auditFormData = useCallback((data: Record<string, unknown>): string[] => {
    return SecurityAuditor.auditFormData(data);
  }, []);

  const clearSecureStorage = useCallback(() => {
    SecureStorage.clear();
    toast({
      title: 'Secure Storage Cleared',
      description: 'All secure storage data has been cleared.',
    });
  }, [toast]);

  const updateSecurityLevel = useCallback((level: 'low' | 'medium' | 'high') => {
    setSecurityState(prev => ({
      ...prev,
      securityLevel: level,
    }));

    // Store security preference
    SecureStorage.setItem('security_level', level);
  }, []);

  const contextValue: SecurityContextValue = {
    ...securityState,
    refreshCSRFToken,
    reportSecurityIssue,
    auditFormData,
    clearSecureStorage,
    updateSecurityLevel,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextValue => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};

/**
 * Security guard component for protecting routes and components
 */
interface SecurityGuardProps {
  children: React.ReactNode;
  requiredSecurityLevel?: 'low' | 'medium' | 'high';
  requireHTTPS?: boolean;
  requireCSRF?: boolean;
  fallback?: React.ReactNode;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({
  children,
  requiredSecurityLevel = 'medium',
  requireHTTPS = false,
  requireCSRF = false,
  fallback,
}) => {
  const security = useSecurity();

  // Check security requirements
  const securityLevels = { low: 1, medium: 2, high: 3 };
  const hasRequiredSecurityLevel = securityLevels[security.securityLevel] >= securityLevels[requiredSecurityLevel];
  const hasHTTPS = !requireHTTPS || security.isSecureConnection;
  const hasCSRF = !requireCSRF || (security.csrfToken && CSRFProtection.isValidToken(security.csrfToken));

  const isSecure = hasRequiredSecurityLevel && hasHTTPS && hasCSRF;

  if (!isSecure) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[200px] p-4">
        <div className="text-center space-y-2">
          <div className="text-red-600 text-lg font-medium">Security Requirements Not Met</div>
          <div className="text-sm text-gray-600">
            {!hasRequiredSecurityLevel && <div>Security level too low</div>}
            {!hasHTTPS && <div>HTTPS connection required</div>}
            {!hasCSRF && <div>CSRF protection required</div>}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Security status component
 */
export const SecurityStatus: React.FC<{ className?: string }> = ({ className }) => {
  const security = useSecurity();

  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${getSecurityColor(security.securityLevel)}`}>
        <span className="font-medium">Security: {security.securityLevel}</span>
      </div>
      {security.isSecureConnection && (
        <div className="text-green-600 text-xs">🔒 HTTPS</div>
      )}
      {security.csrfToken && (
        <div className="text-green-600 text-xs">🛡️ CSRF</div>
      )}
    </div>
  );
};

/**
 * Hook for security-aware API calls
 */
export const useSecureApiCall = () => {
  const security = useSecurity();

  const makeSecureCall = useCallback(async (
    apiCall: () => Promise<unknown>,
    options: {
      requireCSRF?: boolean;
      auditResponse?: boolean;
    } = {}
  ): Promise<unknown> => {
    const { requireCSRF = true, auditResponse = false } = options;

    // Check CSRF requirement
    if (requireCSRF && !security.csrfToken) {
      throw new Error('CSRF token required for this operation');
    }

    try {
      const result = await apiCall();

      // Audit response if requested
      if (auditResponse && typeof result === 'object' && result !== null) {
        const issues = security.auditFormData(result as Record<string, unknown>);
        if (issues.length > 0) {
          security.reportSecurityIssue(`API response contains security issues: ${issues.join(', ')}`, 'medium');
        }
      }

      return result;
    } catch (error) {
      // Report security-related errors
      if (error instanceof Error && error.message.includes('security')) {
        security.reportSecurityIssue(error.message, 'high');
      }
      throw error;
    }
  }, [security]);

  return { makeSecureCall };
};
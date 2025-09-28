/**
 * Authentication context with secure token management
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authManager } from '@/lib/api-client';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to refresh token to check if user is logged in
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCSRFToken(),
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        
        // If we have an access token in the response, set it
        if (userData.accessToken && userData.expiresIn) {
          authManager.setAccessToken(userData.accessToken, userData.expiresIn);
        }
      } else if (response.status === 401) {
        // Try to refresh the token
        await authManager.refreshToken();
      }
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      // Don't set error here as user might not be logged in
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Login failed');
      }

      const data = await response.json();
      
      // Set access token in memory
      authManager.setAccessToken(data.accessToken, data.expiresIn);
      
      // Set user data
      setUser(data.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call logout endpoint to clear server-side session
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCSRFToken(),
        },
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
      // Continue with client-side cleanup even if server request fails
    } finally {
      // Clear client-side state
      authManager.clearTokens();
      setUser(null);
      setIsLoading(false);
      
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const refreshToken = async () => {
    try {
      setError(null);
      
      const token = await authManager.refreshToken();
      
      // Get updated user info
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-CSRF-Token': getCSRFToken(),
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch (error) {
      console.warn('Token refresh failed:', error);
      authManager.clearTokens();
      setUser(null);
      throw error;
    }
  };

  const getCSRFToken = (): string => {
    // Get CSRF token from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) return metaToken;

    // Fallback to cookie
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));
    return csrfCookie ? csrfCookie.split('=')[1] : '';
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protecting routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: string
) => {
  return (props: P) => {
    const { user, isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Verifying access...</span>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (requiredRole && (!user?.roles.includes(requiredRole) && !user?.roles.includes('admin'))) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this resource.
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};
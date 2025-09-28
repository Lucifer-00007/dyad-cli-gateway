/**
 * Main application providers wrapper
 */

import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { SecurityProvider } from '@/contexts/security-context';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { queryClient, initializeQueryPersistence } from '@/lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

// Initialize query persistence
initializeQueryPersistence().catch(console.warn);

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SecurityProvider initialSecurityLevel="high">
          <FeatureFlagsProvider
            config={{
              environment: import.meta.env.MODE as 'development' | 'staging' | 'production',
            }}
          >
            <AuthProvider>
              {children}
              <Toaster 
                position="top-right"
                expand={true}
                richColors
                closeButton
              />
            </AuthProvider>
          </FeatureFlagsProvider>
        </SecurityProvider>
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};
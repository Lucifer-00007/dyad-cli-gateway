import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProviders } from '@/providers/app-providers';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { MainLayout } from '@/components/layout';
import { APP_CONSTANTS } from '@/constants';
import Index from './pages/Index';
import Providers from './pages/Providers';
import ProviderCreate from './pages/ProviderCreate';
import ProviderEdit from './pages/ProviderEdit';
import ProviderDetail from './pages/ProviderDetail';
import Monitoring from './pages/Monitoring';
import ApiKeys from './pages/ApiKeys';
import ChatPlayground from './pages/ChatPlayground';
import NotFound from './pages/NotFound';
import { AdvancedFeaturesDemo } from './components/advanced-features-demo';
import { SecurityDashboard } from './components/security-dashboard';
import { PWAInstallPrompt } from './components/pwa-install-prompt';
import React from 'react';

const App = () => {
  const [showPWAPrompt, setShowPWAPrompt] = React.useState(false);

  React.useEffect(() => {
    // Show PWA prompt after a delay to avoid overwhelming users
    const timer = setTimeout(() => {
      setShowPWAPrompt(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AppProviders>
      <ErrorBoundary>
        <TooltipProvider>
          <BrowserRouter>
            <MainLayout>
              {/* PWA Install Prompt - positioned at top of app */}
              {showPWAPrompt && (
                <div className="fixed top-4 right-4 z-50 max-w-sm">
                  <PWAInstallPrompt />
                </div>
              )}
              
              <Routes>
                <Route path={APP_CONSTANTS.ROUTES.HOME} element={<Index />} />
                <Route path={APP_CONSTANTS.ROUTES.PROVIDERS} element={<Providers />} />
                <Route path="/providers/new" element={<ProviderCreate />} />
                <Route path="/providers/:id" element={<ProviderDetail />} />
                <Route path="/providers/:id/edit" element={<ProviderEdit />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path={APP_CONSTANTS.ROUTES.API_KEYS} element={<ApiKeys />} />
                <Route path="/chat" element={<ChatPlayground />} />
                <Route path="/advanced-features" element={<AdvancedFeaturesDemo />} />
                <Route path="/security" element={<SecurityDashboard />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path={APP_CONSTANTS.ROUTES.NOT_FOUND} element={<NotFound />} />
              </Routes>
            </MainLayout>
          </BrowserRouter>
        </TooltipProvider>
      </ErrorBoundary>
    </AppProviders>
  );
};

export default App;

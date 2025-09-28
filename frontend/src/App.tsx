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
import NotFound from './pages/NotFound';

const App = () => (
  <AppProviders>
    <ErrorBoundary>
      <TooltipProvider>
        <BrowserRouter>
          <MainLayout>
            <Routes>
              <Route path={APP_CONSTANTS.ROUTES.HOME} element={<Index />} />
              <Route path={APP_CONSTANTS.ROUTES.PROVIDERS} element={<Providers />} />
              <Route path="/providers/new" element={<ProviderCreate />} />
              <Route path="/providers/:id" element={<ProviderDetail />} />
              <Route path="/providers/:id/edit" element={<ProviderEdit />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path={APP_CONSTANTS.ROUTES.NOT_FOUND} element={<NotFound />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  </AppProviders>
);

export default App;

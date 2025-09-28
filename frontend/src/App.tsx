import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProviders } from '@/providers/app-providers';
import { APP_CONSTANTS } from '@/constants';
import Index from './pages/Index';
import NotFound from './pages/NotFound';

const App = () => (
  <AppProviders>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path={APP_CONSTANTS.ROUTES.HOME} element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path={APP_CONSTANTS.ROUTES.NOT_FOUND} element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AppProviders>
);

export default App;

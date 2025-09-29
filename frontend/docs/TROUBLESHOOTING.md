# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Dyad CLI Gateway Admin UI.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Authentication Issues](#authentication-issues)
- [API Connection Problems](#api-connection-problems)
- [Performance Issues](#performance-issues)
- [UI/UX Problems](#uiux-problems)
- [Build and Development Issues](#build-and-development-issues)
- [Browser Compatibility](#browser-compatibility)
- [Network and CORS Issues](#network-and-cors-issues)
- [WebSocket Connection Problems](#websocket-connection-problems)
- [Debug Tools and Logging](#debug-tools-and-logging)

## Quick Diagnostics

### Health Check Dashboard

Access the built-in diagnostics at `/health` or use the test setup component:

```typescript
// Enable debug mode
localStorage.setItem('dyad-debug', 'true');

// Check system status
localStorage.setItem('dyad-show-diagnostics', 'true');
```

### Common Quick Fixes

1. **Clear browser cache and cookies**
   ```bash
   # Chrome DevTools
   F12 → Application → Storage → Clear storage
   ```

2. **Reset application state**
   ```typescript
   // Clear all local storage
   localStorage.clear();
   sessionStorage.clear();
   
   // Reload the page
   window.location.reload();
   ```

3. **Check network connectivity**
   ```bash
   # Test backend connectivity
   curl -f http://localhost:3000/api/v1/system/health
   ```

## Authentication Issues

### Problem: "Authentication required" or 401 errors

#### Symptoms
- Redirected to login page repeatedly
- API calls failing with 401 status
- "Token expired" messages

#### Diagnosis
```typescript
// Check authentication state
console.log('Auth State:', {
  isAuthenticated: authManager.isAuthenticated(),
  accessToken: authManager.getAccessToken(),
  tokenExpired: authManager.isTokenExpired(),
  refreshToken: document.cookie.includes('refresh-token'),
});
```

#### Solutions

1. **Token Refresh Issues**
   ```typescript
   // Manual token refresh
   try {
     await authManager.refreshTokens();
     console.log('Token refresh successful');
   } catch (error) {
     console.error('Token refresh failed:', error);
     // Clear tokens and redirect to login
     authManager.clearTokens();
     window.location.href = '/login';
   }
   ```

2. **HttpOnly Cookie Problems**
   - Ensure backend sets `httpOnly: true, secure: true, sameSite: 'strict'`
   - Check if cookies are being sent with requests
   - Verify domain and path settings

3. **CSRF Token Issues**
   ```typescript
   // Check CSRF token
   const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
   console.log('CSRF Token:', csrfToken);
   
   // Manually set CSRF token
   const metaTag = document.createElement('meta');
   metaTag.name = 'csrf-token';
   metaTag.content = 'your-csrf-token';
   document.head.appendChild(metaTag);
   ```

### Problem: Login form not working

#### Symptoms
- Login button doesn't respond
- Form validation errors
- Network errors on login

#### Solutions

1. **Check form validation**
   ```typescript
   // Debug form state
   const { formState: { errors, isValid } } = useForm();
   console.log('Form errors:', errors);
   console.log('Form valid:', isValid);
   ```

2. **Network debugging**
   ```typescript
   // Test login endpoint directly
   const testLogin = async () => {
     try {
       const response = await fetch('/api/v1/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
       });
       console.log('Login test:', response.status, await response.text());
     } catch (error) {
       console.error('Login test failed:', error);
     }
   };
   ```

## API Connection Problems

### Problem: "Network Error" or connection timeouts

#### Symptoms
- API calls failing with network errors
- Timeout messages
- "ERR_NETWORK" in console

#### Diagnosis
```typescript
// Test API connectivity
const testApiConnection = async () => {
  const endpoints = [
    '/api/v1/system/health',
    '/api/v1/admin/providers',
    '/api/v1/models',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`);
      console.log(`${endpoint}: ${response.status}`);
    } catch (error) {
      console.error(`${endpoint}: FAILED`, error);
    }
  }
};
```

#### Solutions

1. **Backend Not Running**
   ```bash
   # Check if backend is running
   curl -f http://localhost:3000/api/v1/system/health
   
   # Start backend if needed
   cd backend && npm run dev
   ```

2. **Wrong API Base URL**
   ```typescript
   // Check configuration
   console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
   
   // Override for testing
   localStorage.setItem('dyad-api-override', 'http://localhost:3000');
   ```

3. **Firewall or Proxy Issues**
   - Check corporate firewall settings
   - Try different network (mobile hotspot)
   - Disable VPN temporarily

### Problem: API calls returning 404 errors

#### Symptoms
- Specific endpoints returning 404
- "Not Found" errors in console
- Some features not working

#### Solutions

1. **Check API versioning**
   ```typescript
   // Verify API version
   const response = await fetch('/api/v1/system/health');
   console.log('API Version:', response.headers.get('X-API-Version'));
   ```

2. **Backend route configuration**
   - Verify backend routes are properly configured
   - Check if admin routes are enabled
   - Ensure middleware is not blocking requests

## Performance Issues

### Problem: Slow loading or unresponsive UI

#### Symptoms
- Long loading times
- UI freezing
- High memory usage
- Poor Core Web Vitals scores

#### Diagnosis
```typescript
// Performance monitoring
const { metrics, getPerformanceScore } = usePerformanceMonitor();
console.log('Performance Metrics:', metrics);
console.log('Performance Score:', getPerformanceScore());

// Memory usage
console.log('Memory Usage:', {
  used: performance.memory?.usedJSHeapSize,
  total: performance.memory?.totalJSHeapSize,
  limit: performance.memory?.jsHeapSizeLimit,
});
```

#### Solutions

1. **Large Dataset Issues**
   ```typescript
   // Enable virtual scrolling
   <FeatureGate feature="virtual-scrolling">
     <VirtualTable data={largeDataset} />
   </FeatureGate>
   
   // Implement pagination
   const { data } = useProviders({ 
     page: currentPage, 
     limit: 50 // Reduce page size
   });
   ```

2. **Memory Leaks**
   ```typescript
   // Check for memory leaks
   useEffect(() => {
     const interval = setInterval(() => {
       // Cleanup function
     }, 1000);
     
     return () => clearInterval(interval); // Important!
   }, []);
   ```

3. **Bundle Size Optimization**
   ```bash
   # Analyze bundle size
   npm run build:analyze
   
   # Check for large dependencies
   npx webpack-bundle-analyzer dist/assets/*.js
   ```

### Problem: Slow API responses

#### Symptoms
- Long wait times for data
- Timeout errors
- Poor user experience

#### Solutions

1. **Implement caching**
   ```typescript
   // Increase cache time for stable data
   const { data } = useQuery({
     queryKey: ['providers'],
     queryFn: ProviderService.getProviders,
     staleTime: 10 * 60 * 1000, // 10 minutes
   });
   ```

2. **Optimize queries**
   ```typescript
   // Use pagination and filtering
   const { data } = useProviders({
     page: 1,
     limit: 20,
     fields: 'name,type,enabled', // Only fetch needed fields
   });
   ```

## UI/UX Problems

### Problem: Components not rendering correctly

#### Symptoms
- Missing components
- Layout issues
- Styling problems
- Accessibility issues

#### Diagnosis
```typescript
// Check component errors
const ComponentDebugger = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <div>Component Error: {error.message}</div>
      )}
      onError={(error, errorInfo) => {
        console.error('Component Error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

#### Solutions

1. **Theme Issues**
   ```typescript
   // Check theme state
   const { theme, setTheme } = useTheme();
   console.log('Current theme:', theme);
   
   // Reset theme
   setTheme('system');
   ```

2. **CSS/Tailwind Issues**
   ```bash
   # Rebuild CSS
   npm run build:css
   
   # Check Tailwind configuration
   npx tailwindcss --init
   ```

3. **Component State Issues**
   ```typescript
   // Debug component state
   const DebugComponent = () => {
     const [state, setState] = useState(initialState);
     
     useEffect(() => {
       console.log('Component state changed:', state);
     }, [state]);
     
     return <div>Debug info: {JSON.stringify(state)}</div>;
   };
   ```

### Problem: Accessibility issues

#### Symptoms
- Screen reader problems
- Keyboard navigation not working
- Poor contrast ratios
- Missing ARIA labels

#### Solutions

1. **Run accessibility audit**
   ```bash
   # Install axe-core
   npm install --save-dev @axe-core/react
   
   # Run accessibility tests
   npm run test:a11y
   ```

2. **Manual testing**
   ```typescript
   // Test keyboard navigation
   const testKeyboardNavigation = () => {
     // Tab through all interactive elements
     const interactiveElements = document.querySelectorAll(
       'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
     );
     
     interactiveElements.forEach((element, index) => {
       console.log(`Element ${index}:`, element);
     });
   };
   ```

## Build and Development Issues

### Problem: Build failures

#### Symptoms
- TypeScript compilation errors
- Vite build errors
- Missing dependencies

#### Solutions

1. **TypeScript Errors**
   ```bash
   # Check TypeScript configuration
   npx tsc --noEmit
   
   # Fix common issues
   npm run type-check
   ```

2. **Dependency Issues**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   
   # Check for peer dependency warnings
   npm ls
   ```

3. **Vite Configuration Issues**
   ```typescript
   // Debug Vite config
   import { defineConfig } from 'vite';
   
   export default defineConfig({
     // Add debug logging
     logLevel: 'info',
     build: {
       // Increase memory limit
       chunkSizeWarningLimit: 1000,
     },
   });
   ```

### Problem: Hot reload not working

#### Symptoms
- Changes not reflected in browser
- Manual refresh required
- Development server issues

#### Solutions

1. **Clear Vite cache**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

2. **Check file watching**
   ```bash
   # Increase file watcher limit (Linux/Mac)
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## Browser Compatibility

### Problem: Features not working in specific browsers

#### Symptoms
- JavaScript errors in older browsers
- CSS not rendering correctly
- Missing functionality

#### Solutions

1. **Check browser support**
   ```typescript
   // Feature detection
   const checkBrowserSupport = () => {
     const features = {
       fetch: typeof fetch !== 'undefined',
       webSocket: typeof WebSocket !== 'undefined',
       localStorage: typeof localStorage !== 'undefined',
       es6: typeof Symbol !== 'undefined',
     };
     
     console.log('Browser features:', features);
     return features;
   };
   ```

2. **Add polyfills**
   ```bash
   # Install polyfills
   npm install --save core-js
   ```

3. **Update browserslist**
   ```json
   // package.json
   {
     "browserslist": [
       "> 1%",
       "last 2 versions",
       "not dead"
     ]
   }
   ```

## Network and CORS Issues

### Problem: CORS errors

#### Symptoms
- "Access-Control-Allow-Origin" errors
- Preflight request failures
- Cross-origin request blocked

#### Solutions

1. **Development proxy**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:3000',
           changeOrigin: true,
         },
       },
     },
   });
   ```

2. **Backend CORS configuration**
   ```javascript
   // Backend: Enable CORS for frontend domain
   app.use(cors({
     origin: ['http://localhost:8080', 'https://admin.dyad-cli-gateway.com'],
     credentials: true,
   }));
   ```

## WebSocket Connection Problems

### Problem: Real-time updates not working

#### Symptoms
- No live data updates
- WebSocket connection failures
- "Connection refused" errors

#### Diagnosis
```typescript
// Test WebSocket connection
const testWebSocket = () => {
  const ws = new WebSocket('ws://localhost:3000/ws');
  
  ws.onopen = () => console.log('WebSocket connected');
  ws.onclose = () => console.log('WebSocket disconnected');
  ws.onerror = (error) => console.error('WebSocket error:', error);
  ws.onmessage = (event) => console.log('WebSocket message:', event.data);
  
  // Test message
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
  }, 1000);
};
```

#### Solutions

1. **Fallback to polling**
   ```typescript
   // Disable WebSocket and use polling
   const useRealTimeData = () => {
     const [useWebSocket, setUseWebSocket] = useState(true);
     
     useEffect(() => {
       // Test WebSocket connection
       const ws = new WebSocket(wsUrl);
       ws.onerror = () => {
         console.log('WebSocket failed, falling back to polling');
         setUseWebSocket(false);
       };
     }, []);
     
     // Use polling if WebSocket fails
     if (!useWebSocket) {
       return useQuery({
         queryKey: ['realtime-data'],
         queryFn: fetchData,
         refetchInterval: 5000, // Poll every 5 seconds
       });
     }
   };
   ```

## Debug Tools and Logging

### Enable Debug Mode

```typescript
// Enable comprehensive debugging
localStorage.setItem('dyad-debug', 'true');
localStorage.setItem('dyad-api-debug', 'true');
localStorage.setItem('dyad-performance-debug', 'true');
```

### Browser DevTools

1. **Network Tab**
   - Monitor API requests and responses
   - Check request headers and timing
   - Identify failed requests

2. **Console Tab**
   - View error messages and logs
   - Test JavaScript functions
   - Monitor performance metrics

3. **Application Tab**
   - Inspect localStorage and sessionStorage
   - Check cookies and tokens
   - Monitor service worker status

### React DevTools

```bash
# Install React DevTools browser extension
# Available for Chrome, Firefox, and Edge
```

### Performance Profiling

```typescript
// Performance profiler
const ProfilerWrapper = ({ children, id }) => {
  return (
    <Profiler
      id={id}
      onRender={(id, phase, actualDuration) => {
        console.log(`${id} (${phase}): ${actualDuration}ms`);
      }}
    >
      {children}
    </Profiler>
  );
};
```

### Custom Debug Panel

```typescript
// Debug information panel
const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!import.meta.env.DEV) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button onClick={() => setIsOpen(!isOpen)}>
        Debug
      </Button>
      
      {isOpen && (
        <Card className="mt-2 p-4 w-80">
          <h3>Debug Information</h3>
          <div className="space-y-2 text-sm">
            <div>Environment: {import.meta.env.MODE}</div>
            <div>API URL: {import.meta.env.VITE_API_BASE_URL}</div>
            <div>Auth Status: {authManager.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}</div>
            <div>Theme: {theme}</div>
            <div>Performance Score: {getPerformanceScore()}</div>
          </div>
        </Card>
      )}
    </div>
  );
};
```

## Getting Help

### Before Reporting Issues

1. **Check this troubleshooting guide**
2. **Enable debug mode and collect logs**
3. **Test with minimal configuration**
4. **Verify backend connectivity**
5. **Check browser console for errors**

### Information to Include

When reporting issues, include:

- **Environment details** (OS, browser, Node.js version)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Console logs and error messages**
- **Network requests** (from DevTools)
- **Configuration** (environment variables, feature flags)

### Debug Information Export

```typescript
// Export debug information
const exportDebugInfo = () => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: import.meta.env.MODE,
    userAgent: navigator.userAgent,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    authStatus: authManager.isAuthenticated(),
    localStorage: { ...localStorage },
    performance: getPerformanceMetrics(),
    errors: getRecentErrors(),
  };
  
  const blob = new Blob([JSON.stringify(debugInfo, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dyad-debug-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};
```

## Emergency Recovery

### Complete Reset

If all else fails, perform a complete reset:

```bash
# 1. Clear all browser data
# Chrome: Settings → Privacy → Clear browsing data

# 2. Reset local development
rm -rf node_modules package-lock.json
npm install

# 3. Clear Vite cache
rm -rf node_modules/.vite

# 4. Restart development server
npm run dev

# 5. Test with fresh browser session (incognito mode)
```

### Rollback to Working Version

```bash
# Check git history
git log --oneline

# Rollback to last working commit
git checkout <commit-hash>

# Create new branch from working state
git checkout -b hotfix/rollback-to-working
```

This troubleshooting guide should help you resolve most common issues. If you continue to experience problems, enable debug mode and collect the information as described above before seeking additional help.
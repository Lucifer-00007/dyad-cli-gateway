import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    await page.goto('http://localhost:8080');
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 30000 });
    
    console.log('✅ Application is ready');

    // Perform any global setup tasks here
    // For example, create test data, authenticate, etc.
    
    // Mock API responses for consistent testing
    await page.route('**/api/v1/admin/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('/providers') && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              results: [
                {
                  _id: 'test-provider-1',
                  name: 'Test Provider 1',
                  slug: 'test-provider-1',
                  type: 'http-sdk',
                  description: 'A test provider for E2E testing',
                  enabled: true,
                  adapterConfig: {
                    baseUrl: 'https://api.example.com',
                    authType: 'api-key',
                  },
                  models: [
                    {
                      dyadModelId: 'gpt-4',
                      adapterModelId: 'gpt-4-turbo',
                      maxTokens: 4096,
                    },
                  ],
                  healthStatus: {
                    status: 'healthy',
                    lastChecked: new Date().toISOString(),
                    responseTime: 150,
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              totalResults: 1,
              page: 1,
              totalPages: 1,
              limit: 10,
            },
          }),
        });
      } else {
        // Continue with the original request for other endpoints
        await route.continue();
      }
    });

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;
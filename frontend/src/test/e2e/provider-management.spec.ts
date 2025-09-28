/**
 * End-to-end tests for provider management workflows
 */

import { test, expect } from '@playwright/test';

test.describe('Provider Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to providers page
    await page.goto('/providers');
    await page.waitForLoadState('networkidle');
  });

  test('should display providers list', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Providers/);
    
    // Check page header
    await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
    
    // Check providers table
    await expect(page.getByRole('table')).toBeVisible();
    
    // Check for test provider
    await expect(page.getByText('Test Provider 1')).toBeVisible();
    await expect(page.getByText('http-sdk')).toBeVisible();
    await expect(page.getByText('Healthy')).toBeVisible();
  });

  test('should navigate to create provider page', async ({ page }) => {
    // Click create provider button
    await page.getByRole('button', { name: 'Create Provider' }).click();
    
    // Should navigate to create page
    await expect(page).toHaveURL('/providers/create');
    await expect(page.getByRole('heading', { name: 'Create Provider' })).toBeVisible();
  });

  test('should create a new provider', async ({ page }) => {
    // Navigate to create page
    await page.getByRole('button', { name: 'Create Provider' }).click();
    
    // Fill out the form
    await page.getByLabel('Provider Name').fill('New Test Provider');
    await page.getByLabel('Provider Slug').fill('new-test-provider');
    await page.getByLabel('Provider Type').selectOption('http-sdk');
    await page.getByLabel('Description').fill('A new test provider for E2E testing');
    
    // Configure adapter settings
    await page.getByLabel('Base URL').fill('https://api.newprovider.com');
    await page.getByLabel('Auth Type').selectOption('api-key');
    
    // Add model mapping
    await page.getByRole('button', { name: 'Add Model Mapping' }).click();
    await page.getByLabel('Dyad Model ID').fill('gpt-3.5-turbo');
    await page.getByLabel('Adapter Model ID').fill('gpt-3.5-turbo-0125');
    await page.getByLabel('Max Tokens').fill('4096');
    
    // Mock the create provider API call
    await page.route('**/api/v1/admin/providers', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              _id: 'new-provider-id',
              name: 'New Test Provider',
              slug: 'new-test-provider',
              type: 'http-sdk',
              description: 'A new test provider for E2E testing',
              enabled: true,
              adapterConfig: {
                baseUrl: 'https://api.newprovider.com',
                authType: 'api-key',
              },
              models: [
                {
                  dyadModelId: 'gpt-3.5-turbo',
                  adapterModelId: 'gpt-3.5-turbo-0125',
                  maxTokens: 4096,
                },
              ],
              healthStatus: {
                status: 'unknown',
                lastChecked: null,
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });
    
    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Should redirect to providers list
    await expect(page).toHaveURL('/providers');
    
    // Should show success message
    await expect(page.getByText('Provider created successfully')).toBeVisible();
  });

  test('should edit an existing provider', async ({ page }) => {
    // Click edit button for first provider
    await page.getByRole('button', { name: 'Edit' }).first().click();
    
    // Should navigate to edit page
    await expect(page).toHaveURL(/\/providers\/.*\/edit/);
    await expect(page.getByRole('heading', { name: 'Edit Provider' })).toBeVisible();
    
    // Form should be pre-filled
    await expect(page.getByLabel('Provider Name')).toHaveValue('Test Provider 1');
    
    // Make changes
    await page.getByLabel('Description').fill('Updated description for E2E testing');
    
    // Mock the update provider API call
    await page.route('**/api/v1/admin/providers/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              _id: 'test-provider-1',
              name: 'Test Provider 1',
              slug: 'test-provider-1',
              type: 'http-sdk',
              description: 'Updated description for E2E testing',
              enabled: true,
              adapterConfig: {
                baseUrl: 'https://api.example.com',
                authType: 'api-key',
              },
              models: [],
              healthStatus: {
                status: 'healthy',
                lastChecked: new Date().toISOString(),
                responseTime: 150,
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });
    
    // Submit changes
    await page.getByRole('button', { name: 'Update' }).click();
    
    // Should redirect to providers list
    await expect(page).toHaveURL('/providers');
    
    // Should show success message
    await expect(page.getByText('Provider updated successfully')).toBeVisible();
  });

  test('should test a provider', async ({ page }) => {
    // Click test button for first provider
    await page.getByRole('button', { name: 'Test' }).first().click();
    
    // Should open test dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Test Provider: Test Provider 1')).toBeVisible();
    
    // Configure test parameters
    await page.getByLabel('Model').selectOption('gpt-4');
    await page.getByLabel('Message').fill('Hello, this is a test message');
    
    // Mock the test provider API call
    await page.route('**/api/v1/admin/providers/*/test', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              success: true,
              latency: 250,
              response: {
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: 'Hello! This is a test response from the provider.',
                    },
                  },
                ],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 12,
                  total_tokens: 22,
                },
              },
            },
          }),
        });
      }
    });
    
    // Run test
    await page.getByRole('button', { name: 'Run Test' }).click();
    
    // Should show test results
    await expect(page.getByText('Test Results')).toBeVisible();
    await expect(page.getByText('Success')).toBeVisible();
    await expect(page.getByText('250ms')).toBeVisible();
    await expect(page.getByText('Hello! This is a test response from the provider.')).toBeVisible();
    
    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should delete a provider with confirmation', async ({ page }) => {
    // Click delete button for first provider
    await page.getByRole('button', { name: 'Delete' }).first().click();
    
    // Should show confirmation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete Provider')).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();
    
    // Cancel first
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Try delete again
    await page.getByRole('button', { name: 'Delete' }).first().click();
    
    // Mock the delete provider API call
    await page.route('**/api/v1/admin/providers/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Provider deleted successfully',
          }),
        });
      }
    });
    
    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    
    // Should show success message
    await expect(page.getByText('Provider deleted successfully')).toBeVisible();
  });

  test('should search and filter providers', async ({ page }) => {
    // Add more test data for filtering
    await page.route('**/api/v1/admin/providers', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              results: [
                {
                  _id: 'provider-1',
                  name: 'OpenAI Provider',
                  slug: 'openai-provider',
                  type: 'http-sdk',
                  enabled: true,
                  healthStatus: { status: 'healthy' },
                },
                {
                  _id: 'provider-2',
                  name: 'Local Model Provider',
                  slug: 'local-provider',
                  type: 'spawn-cli',
                  enabled: false,
                  healthStatus: { status: 'unhealthy' },
                },
                {
                  _id: 'provider-3',
                  name: 'Anthropic Provider',
                  slug: 'anthropic-provider',
                  type: 'proxy',
                  enabled: true,
                  healthStatus: { status: 'healthy' },
                },
              ],
              totalResults: 3,
              page: 1,
              totalPages: 1,
              limit: 10,
            },
          }),
        });
      }
    });
    
    // Reload page to get new data
    await page.reload();
    
    // Should show all providers initially
    await expect(page.getByText('OpenAI Provider')).toBeVisible();
    await expect(page.getByText('Local Model Provider')).toBeVisible();
    await expect(page.getByText('Anthropic Provider')).toBeVisible();
    
    // Search for specific provider
    await page.getByPlaceholder('Search providers...').fill('OpenAI');
    
    // Should filter results
    await expect(page.getByText('OpenAI Provider')).toBeVisible();
    await expect(page.getByText('Local Model Provider')).not.toBeVisible();
    await expect(page.getByText('Anthropic Provider')).not.toBeVisible();
    
    // Clear search
    await page.getByPlaceholder('Search providers...').clear();
    
    // Filter by type
    await page.getByLabel('Filter by type').selectOption('http-sdk');
    
    // Should show only HTTP SDK providers
    await expect(page.getByText('OpenAI Provider')).toBeVisible();
    await expect(page.getByText('Local Model Provider')).not.toBeVisible();
    await expect(page.getByText('Anthropic Provider')).not.toBeVisible();
    
    // Filter by status
    await page.getByLabel('Filter by status').selectOption('enabled');
    
    // Should show only enabled providers
    await expect(page.getByText('OpenAI Provider')).toBeVisible();
    await expect(page.getByText('Anthropic Provider')).toBeVisible();
    await expect(page.getByText('Local Model Provider')).not.toBeVisible();
  });

  test('should handle provider status toggle', async ({ page }) => {
    // Mock the toggle provider API call
    await page.route('**/api/v1/admin/providers/*/toggle', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              _id: 'test-provider-1',
              enabled: false, // Toggled to disabled
            },
          }),
        });
      }
    });
    
    // Find and click the toggle switch
    const toggleSwitch = page.getByRole('switch').first();
    await expect(toggleSwitch).toBeChecked();
    
    await toggleSwitch.click();
    
    // Should show success message
    await expect(page.getByText('Provider status updated')).toBeVisible();
    
    // Switch should now be unchecked
    await expect(toggleSwitch).not.toBeChecked();
  });

  test('should be accessible via keyboard navigation', async ({ page }) => {
    // Navigate using keyboard
    await page.keyboard.press('Tab'); // Focus first interactive element
    await page.keyboard.press('Tab'); // Navigate to next element
    
    // Should be able to activate buttons with Enter/Space
    await page.keyboard.press('Enter');
    
    // Should be able to navigate table with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    
    // Should be able to access dropdown menus
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  });

  test('should work on mobile devices', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('This test is only for mobile devices');
    }
    
    // Check mobile layout
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    
    // Open mobile menu
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Check responsive table
    await expect(page.getByRole('table')).toBeVisible();
    
    // Should be able to scroll horizontally if needed
    await page.mouse.wheel(100, 0);
  });
});
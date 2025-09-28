/**
 * End-to-end tests for chat playground functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Chat Playground', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat playground
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
  });

  test('should display chat playground interface', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Chat Playground/);
    
    // Check page header
    await expect(page.getByRole('heading', { name: 'Chat Playground' })).toBeVisible();
    
    // Check main interface elements
    await expect(page.getByLabel('Select Model')).toBeVisible();
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Check conversation area
    await expect(page.getByTestId('conversation-area')).toBeVisible();
  });

  test('should send a chat message', async ({ page }) => {
    // Mock available models
    await page.route('**/api/v1/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'gpt-4',
              object: 'model',
              created: Date.now(),
              owned_by: 'openai',
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model',
              created: Date.now(),
              owned_by: 'openai',
            },
          ],
        }),
      });
    });

    // Mock chat completion
    await page.route('**/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you today?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        }),
      });
    });

    // Select model
    await page.getByLabel('Select Model').selectOption('gpt-4');
    
    // Type message
    const messageInput = page.getByPlaceholder('Type your message...');
    await messageInput.fill('Hello, how are you?');
    
    // Send message
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Should show user message
    await expect(page.getByText('Hello, how are you?')).toBeVisible();
    
    // Should show loading indicator
    await expect(page.getByTestId('typing-indicator')).toBeVisible();
    
    // Should show assistant response
    await expect(page.getByText('Hello! How can I help you today?')).toBeVisible();
    
    // Should show message metadata
    await expect(page.getByText('gpt-4')).toBeVisible();
    await expect(page.getByText('18 tokens')).toBeVisible();
  });

  test('should handle streaming responses', async ({ page }) => {
    // Mock streaming chat completion
    await page.route('**/api/v1/chat/completions', async (route) => {
      const request = route.request();
      const body = await request.postDataJSON();
      
      if (body.stream) {
        // Simulate streaming response
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" there!"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" How"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" can"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" I"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" help"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" you?"}}]}\n\n',
          'data: [DONE]\n\n',
        ];
        
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: chunks.join(''),
        });
      }
    });

    // Enable streaming
    await page.getByLabel('Enable Streaming').check();
    
    // Select model and send message
    await page.getByLabel('Select Model').selectOption('gpt-4');
    await page.getByPlaceholder('Type your message...').fill('Hello');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Should show streaming indicator
    await expect(page.getByTestId('streaming-indicator')).toBeVisible();
    
    // Should show partial response building up
    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByText('Hello there!')).toBeVisible();
    await expect(page.getByText('Hello there! How can I help you?')).toBeVisible();
    
    // Should show cancel button during streaming
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should cancel streaming response', async ({ page }) => {
    // Mock long streaming response
    await page.route('**/api/v1/chat/completions', async (route) => {
      // Simulate a response that takes time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: 'data: {"choices":[{"delta":{"content":"This is a long response..."}}]}\n\n',
      });
    });

    // Enable streaming and send message
    await page.getByLabel('Enable Streaming').check();
    await page.getByLabel('Select Model').selectOption('gpt-4');
    await page.getByPlaceholder('Type your message...').fill('Tell me a long story');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for streaming to start
    await expect(page.getByTestId('streaming-indicator')).toBeVisible();
    
    // Cancel the stream
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Should stop streaming
    await expect(page.getByTestId('streaming-indicator')).not.toBeVisible();
    await expect(page.getByText('Response cancelled')).toBeVisible();
  });

  test('should save and load conversations', async ({ page }) => {
    // Send a few messages first
    await page.getByLabel('Select Model').selectOption('gpt-4');
    
    // Mock responses
    await page.route('**/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is a test response.',
              },
            },
          ],
        }),
      });
    });

    // Send first message
    await page.getByPlaceholder('Type your message...').fill('First message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('This is a test response.')).toBeVisible();
    
    // Send second message
    await page.getByPlaceholder('Type your message...').fill('Second message');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Save conversation
    await page.getByRole('button', { name: 'Save Conversation' }).click();
    
    // Should show save dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Conversation Name').fill('Test Conversation');
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Should show success message
    await expect(page.getByText('Conversation saved')).toBeVisible();
    
    // Clear conversation
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Load conversation
    await page.getByRole('button', { name: 'Load Conversation' }).click();
    await expect(page.getByText('Test Conversation')).toBeVisible();
    await page.getByText('Test Conversation').click();
    
    // Should restore conversation
    await expect(page.getByText('First message')).toBeVisible();
    await expect(page.getByText('Second message')).toBeVisible();
  });

  test('should use prompt templates', async ({ page }) => {
    // Open prompt templates
    await page.getByRole('button', { name: 'Templates' }).click();
    
    // Should show template library
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Prompt Templates')).toBeVisible();
    
    // Should show available templates
    await expect(page.getByText('Code Review')).toBeVisible();
    await expect(page.getByText('Explain Code')).toBeVisible();
    await expect(page.getByText('Debug Help')).toBeVisible();
    
    // Select a template
    await page.getByText('Code Review').click();
    
    // Should populate message input
    const messageInput = page.getByPlaceholder('Type your message...');
    await expect(messageInput).toHaveValue(/Please review this code/);
    
    // Close template dialog
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('should inspect request and response details', async ({ page }) => {
    // Mock chat completion with detailed response
    await page.route('**/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });
    });

    // Send message
    await page.getByLabel('Select Model').selectOption('gpt-4');
    await page.getByPlaceholder('Type your message...').fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for response
    await expect(page.getByText('Test response')).toBeVisible();
    
    // Open request inspector
    await page.getByRole('button', { name: 'Inspect' }).first().click();
    
    // Should show request details
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Request Details')).toBeVisible();
    
    // Should show request data
    await expect(page.getByText('gpt-4')).toBeVisible();
    await expect(page.getByText('Test message')).toBeVisible();
    
    // Switch to response tab
    await page.getByRole('tab', { name: 'Response' }).click();
    
    // Should show response data
    await expect(page.getByText('Test response')).toBeVisible();
    await expect(page.getByText('15 tokens')).toBeVisible();
    
    // Switch to metadata tab
    await page.getByRole('tab', { name: 'Metadata' }).click();
    
    // Should show metadata
    await expect(page.getByText('chatcmpl-test')).toBeVisible();
    await expect(page.getByText('stop')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Invalid request: model not found',
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        }),
      });
    });

    // Send message
    await page.getByLabel('Select Model').selectOption('gpt-4');
    await page.getByPlaceholder('Type your message...').fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Should show error message
    await expect(page.getByText('Error: Invalid request: model not found')).toBeVisible();
    
    // Should show retry button
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    
    // Should be able to retry
    await page.getByRole('button', { name: 'Retry' }).click();
  });

  test('should export conversation', async ({ page }) => {
    // Send a message first
    await page.route('**/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Test response for export',
              },
            },
          ],
        }),
      });
    });

    await page.getByLabel('Select Model').selectOption('gpt-4');
    await page.getByPlaceholder('Type your message...').fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();
    
    await expect(page.getByText('Test response for export')).toBeVisible();
    
    // Mock download
    const downloadPromise = page.waitForEvent('download');
    
    // Export conversation
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByText('Export as JSON').click();
    
    // Should trigger download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/conversation.*\.json/);
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Navigate using keyboard
    await page.keyboard.press('Tab'); // Model select
    await page.keyboard.press('Tab'); // Message input
    await page.keyboard.press('Tab'); // Send button
    
    // Should be able to type in message input
    await page.keyboard.press('Shift+Tab'); // Back to message input
    await page.keyboard.type('Hello from keyboard');
    
    // Should be able to send with Enter
    await page.keyboard.press('Enter');
    
    // Should be able to navigate conversation with arrow keys
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
  });

  test('should work on mobile devices', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('This test is only for mobile devices');
    }
    
    // Check mobile layout
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    
    // Message input should be properly sized
    const messageInput = page.getByPlaceholder('Type your message...');
    await expect(messageInput).toBeVisible();
    
    // Should be able to scroll conversation
    await page.mouse.wheel(0, 100);
    
    // Touch interactions should work
    await messageInput.tap();
    await messageInput.fill('Mobile test message');
    await page.getByRole('button', { name: 'Send' }).tap();
  });
});
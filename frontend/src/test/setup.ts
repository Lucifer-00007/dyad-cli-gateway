/**
 * Test setup configuration
 */

import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Mock DOM APIs
beforeAll(() => {
  // Mock document
  Object.defineProperty(global, 'document', {
    value: {
      querySelector: vi.fn(),
      cookie: '',
    },
    writable: true,
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock location
  Object.defineProperty(global, 'location', {
    value: {
      protocol: 'https:',
      href: 'https://localhost:3000',
    },
    writable: true,
  });

  // Mock crypto
  Object.defineProperty(global, 'crypto', {
    value: {
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
    writable: true,
  });

  // Mock btoa/atob
  global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));
  global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));

  // Mock DOMPurify
  vi.mock('dompurify', () => ({
    default: {
      sanitize: vi.fn((input) => {
        // Simple mock that removes script tags
        return input.replace(/<script[^>]*>.*?<\/script>/gi, '');
      }),
    },
  }));
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
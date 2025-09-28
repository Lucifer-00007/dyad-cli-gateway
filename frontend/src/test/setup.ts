/**
 * Test setup configuration
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Mock DOM APIs
beforeAll(() => {
  // Mock localStorage with proper implementation
  const localStorageData: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => localStorageData[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageData[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageData[key];
    }),
    clear: vi.fn(() => {
      Object.keys(localStorageData).forEach(key => delete localStorageData[key]);
    }),
  };
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(global, 'sessionStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock location
  Object.defineProperty(global, 'location', {
    value: {
      protocol: 'https:',
      href: 'https://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      origin: 'https://localhost:3000',
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

  // Mock URL
  Object.defineProperty(global, 'URL', {
    value: {
      createObjectURL: vi.fn(() => 'mock-url'),
      revokeObjectURL: vi.fn(),
    },
    writable: true,
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock performance
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
    },
    writable: true,
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
  global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

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
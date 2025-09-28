/**
 * Security features test suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  sanitizer, 
  securitySchemas, 
  CSRFProtection, 
  SecurityAuditor,
  rateLimitTracker,
  SecureStorage
} from '@/lib/security';
import { SecurityProvider, useSecurity } from '@/contexts/security-context';
import { SecureHtmlContent, SecureTextContent, SecureLogEntry } from '@/components/ui/secure-content';
import { RateLimitIndicator } from '@/components/ui/rate-limit-indicator';
import { SecureProviderForm } from '@/components/ui/secure-form';

// Mock components for testing
const TestSecurityComponent = () => {
  const security = useSecurity();
  return (
    <div>
      <div data-testid="security-level">{security.securityLevel}</div>
      <div data-testid="csrf-token">{security.csrfToken ? 'present' : 'missing'}</div>
      <div data-testid="https-status">{security.isSecureConnection ? 'secure' : 'insecure'}</div>
      <button 
        data-testid="refresh-csrf" 
        onClick={security.refreshCSRFToken}
      >
        Refresh CSRF
      </button>
      <button 
        data-testid="report-issue" 
        onClick={() => security.reportSecurityIssue('Test issue', 'medium')}
      >
        Report Issue
      </button>
    </div>
  );
};

describe('Security Library', () => {
  describe('Input Sanitization', () => {
    it('should sanitize HTML content', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = sanitizer.sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should sanitize text content', () => {
      const maliciousText = 'Normal text\x00\x01\x02with control chars';
      const sanitized = sanitizer.sanitizeText(maliciousText);
      
      expect(sanitized).toBe('Normal textwith control chars');
    });

    it('should sanitize command input', () => {
      const maliciousCommand = 'ls -la; rm -rf /';
      const sanitized = sanitizer.sanitizeCommand(maliciousCommand);
      
      expect(sanitized).not.toContain(';');
      expect(sanitized).toBe('ls -la rm -rf /');
    });

    it('should sanitize URL input', () => {
      const validUrl = 'https://example.com/api';
      const invalidUrl = 'javascript:alert("xss")';
      
      expect(sanitizer.sanitizeUrl(validUrl)).toBe(validUrl);
      expect(sanitizer.sanitizeUrl(invalidUrl)).toBe('');
    });

    it('should sanitize JSON input', () => {
      const validJson = '{"key": "value"}';
      const invalidJson = '{"key": "value"';
      
      expect(sanitizer.sanitizeJson(validJson)).toBe(validJson);
      expect(sanitizer.sanitizeJson(invalidJson)).toBe('');
    });
  });

  describe('Validation Schemas', () => {
    it('should validate provider names', () => {
      const validName = 'My Provider 123';
      const invalidName = '<script>alert("xss")</script>';
      
      expect(() => securitySchemas.providerName.parse(validName)).not.toThrow();
      expect(() => securitySchemas.providerName.parse(invalidName)).toThrow();
    });

    it('should validate provider slugs', () => {
      const validSlug = 'my-provider-123';
      const invalidSlug = 'My Provider!';
      
      expect(() => securitySchemas.providerSlug.parse(validSlug)).not.toThrow();
      expect(() => securitySchemas.providerSlug.parse(invalidSlug)).toThrow();
    });

    it('should validate URLs', () => {
      const validUrl = 'https://api.example.com';
      const invalidUrl = 'not-a-url';
      
      expect(() => securitySchemas.url.parse(validUrl)).not.toThrow();
      expect(() => securitySchemas.url.parse(invalidUrl)).toThrow();
    });

    it('should validate commands', () => {
      const validCommand = 'python script.py --arg value';
      const invalidCommand = 'rm -rf /; malicious';
      
      expect(() => securitySchemas.command.parse(validCommand)).not.toThrow();
      expect(() => securitySchemas.command.parse(invalidCommand)).toThrow();
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(() => {
      // Mock document.querySelector for CSRF token
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === 'meta[name="csrf-token"]') {
          return { getAttribute: () => 'test-csrf-token' } as Element;
        }
        return null;
      });
    });

    it('should get CSRF token from meta tag', () => {
      const token = CSRFProtection.getToken();
      expect(token).toBe('test-csrf-token');
    });

    it('should validate CSRF token format', () => {
      expect(CSRFProtection.isValidToken('valid-token-123456789012345678901234')).toBe(true);
      expect(CSRFProtection.isValidToken('short')).toBe(false);
      expect(CSRFProtection.isValidToken('invalid-chars!')).toBe(false);
    });

    it('should add CSRF token to headers', () => {
      const headers = CSRFProtection.addTokenToHeaders({});
      expect(headers['X-CSRF-Token']).toBe('test-csrf-token');
    });
  });

  describe('Security Auditor', () => {
    it('should detect XSS attempts', () => {
      const formData = {
        name: 'Normal Name',
        description: '<script>alert("xss")</script>',
      };
      
      const issues = SecurityAuditor.auditFormData(formData);
      expect(issues).toContain('Potential XSS in field: description');
    });

    it('should detect SQL injection attempts', () => {
      const formData = {
        query: "'; DROP TABLE users; --",
      };
      
      const issues = SecurityAuditor.auditFormData(formData);
      expect(issues).toContain('Potential SQL injection in field: query');
    });

    it('should detect command injection attempts', () => {
      const formData = {
        command: 'ls -la; rm -rf /',
      };
      
      const issues = SecurityAuditor.auditFormData(formData);
      expect(issues).toContain('Potential command injection in field: command');
    });

    it('should detect path traversal attempts', () => {
      const formData = {
        filePath: '../../../etc/passwd',
      };
      
      const issues = SecurityAuditor.auditFormData(formData);
      expect(issues).toContain('Potential path traversal in field: filePath');
    });

    it('should generate security report', () => {
      const report = SecurityAuditor.generateSecurityReport();
      
      expect(report).toHaveProperty('csrfEnabled');
      expect(report).toHaveProperty('xssProtectionEnabled');
      expect(report).toHaveProperty('httpsOnly');
      expect(report).toHaveProperty('secureStorageUsed');
      expect(report).toHaveProperty('rateLimitingEnabled');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clear rate limit tracker
      rateLimitTracker['requests'].clear();
    });

    it('should track rate limits', () => {
      const key = 'test-endpoint';
      
      expect(rateLimitTracker.isWithinLimit(key)).toBe(true);
      
      // Record requests up to limit
      for (let i = 0; i < 100; i++) {
        rateLimitTracker.recordRequest(key);
      }
      
      expect(rateLimitTracker.isWithinLimit(key)).toBe(false);
    });

    it('should calculate remaining requests', () => {
      const key = 'test-endpoint-2';
      
      rateLimitTracker.recordRequest(key);
      rateLimitTracker.recordRequest(key);
      
      const remaining = rateLimitTracker.getRemainingRequests(key);
      expect(remaining).toBe(98); // 100 - 2
    });

    it('should calculate reset time', () => {
      const key = 'test-endpoint-3';
      
      rateLimitTracker.recordRequest(key);
      
      const resetTime = rateLimitTracker.getResetTime(key);
      expect(resetTime).toBeGreaterThan(0);
    });
  });

  describe('Secure Storage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should store and retrieve secure data', () => {
      const key = 'test-key';
      const value = 'sensitive-data';
      
      SecureStorage.setItem(key, value);
      const retrieved = SecureStorage.getItem(key);
      
      expect(retrieved).toBe(value);
    });

    it('should encode stored data', () => {
      const key = 'test-key-2';
      const value = 'sensitive-data';
      
      SecureStorage.setItem(key, value);
      
      // Check that raw localStorage contains encoded data
      const rawStored = localStorage.getItem('dyad_secure_test-key-2');
      expect(rawStored).not.toBe(value);
      expect(rawStored).toBe(btoa(value));
    });

    it('should clear all secure storage', () => {
      SecureStorage.setItem('key1', 'value1');
      SecureStorage.setItem('key2', 'value2');
      
      SecureStorage.clear();
      
      expect(SecureStorage.getItem('key1')).toBeNull();
      expect(SecureStorage.getItem('key2')).toBeNull();
    });
  });
});

describe('Security Components', () => {
  describe('SecureHtmlContent', () => {
    it('should render sanitized HTML', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      
      render(<SecureHtmlContent content={maliciousHtml} />);
      
      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect(document.querySelector('script')).toBeNull();
    });

    it('should show security warning for unsafe content', () => {
      const unsafeHtml = '<script>alert("xss")</script>';
      
      render(<SecureHtmlContent content={unsafeHtml} showSecurityWarning={true} />);
      
      expect(screen.getByText('Security Warning')).toBeInTheDocument();
    });
  });

  describe('SecureTextContent', () => {
    it('should render sanitized text', () => {
      const maliciousText = 'Normal text\x00\x01with control chars';
      
      render(<SecureTextContent content={maliciousText} />);
      
      expect(screen.getByText('Normal textwith control chars')).toBeInTheDocument();
    });

    it('should truncate long content', () => {
      const longText = 'a'.repeat(2000);
      
      render(<SecureTextContent content={longText} maxLength={100} />);
      
      const displayedText = screen.getByText(/a+\.\.\./);
      expect(displayedText.textContent?.length).toBeLessThanOrEqual(103); // 100 + '...'
    });
  });

  describe('SecureLogEntry', () => {
    it('should render log entry safely', () => {
      const logEntry = {
        timestamp: '2023-01-01T00:00:00Z',
        level: 'info',
        message: 'Test log message',
        metadata: { key: 'value' },
      };
      
      render(<SecureLogEntry entry={logEntry} showMetadata={true} />);
      
      expect(screen.getByText('Test log message')).toBeInTheDocument();
      expect(screen.getByText('info')).toBeInTheDocument();
      expect(screen.getByText('Metadata')).toBeInTheDocument();
    });

    it('should sanitize malicious log messages', () => {
      const logEntry = {
        timestamp: '2023-01-01T00:00:00Z',
        level: 'error',
        message: '<script>alert("xss")</script>Error occurred',
      };
      
      render(<SecureLogEntry entry={logEntry} />);
      
      expect(screen.getByText(/Error occurred/)).toBeInTheDocument();
      expect(document.querySelector('script')).toBeNull();
    });
  });

  describe('RateLimitIndicator', () => {
    it('should display rate limit status', () => {
      const status = {
        limit: 100,
        remaining: 75,
        resetTime: Date.now() + 60000,
        windowMs: 60000,
      };
      
      render(<RateLimitIndicator status={status} variant="detailed" />);
      
      expect(screen.getByText('75/100')).toBeInTheDocument();
      expect(screen.getByText('Rate Limit Status')).toBeInTheDocument();
    });

    it('should show warning for low remaining requests', () => {
      const status = {
        limit: 100,
        remaining: 5,
        resetTime: Date.now() + 60000,
        windowMs: 60000,
      };
      
      render(<RateLimitIndicator status={status} variant="detailed" />);
      
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('should show blocked status when no requests remaining', () => {
      const status = {
        limit: 100,
        remaining: 0,
        resetTime: Date.now() + 60000,
        windowMs: 60000,
      };
      
      render(<RateLimitIndicator status={status} variant="detailed" />);
      
      expect(screen.getByText('Blocked')).toBeInTheDocument();
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });
});

describe('Security Context', () => {
  it('should provide security state and actions', () => {
    render(
      <SecurityProvider>
        <TestSecurityComponent />
      </SecurityProvider>
    );
    
    expect(screen.getByTestId('security-level')).toHaveTextContent('medium');
    expect(screen.getByTestId('csrf-token')).toHaveTextContent('present');
  });

  it('should allow refreshing CSRF token', async () => {
    const user = userEvent.setup();
    
    render(
      <SecurityProvider>
        <TestSecurityComponent />
      </SecurityProvider>
    );
    
    const refreshButton = screen.getByTestId('refresh-csrf');
    await user.click(refreshButton);
    
    // Token should still be present after refresh
    expect(screen.getByTestId('csrf-token')).toHaveTextContent('present');
  });

  it('should allow reporting security issues', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <SecurityProvider>
        <TestSecurityComponent />
      </SecurityProvider>
    );
    
    const reportButton = screen.getByTestId('report-issue');
    await user.click(reportButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Security Issue (medium):', 'Test issue');
    
    consoleSpy.mockRestore();
  });
});

describe('Secure Form', () => {
  it('should validate and sanitize form inputs', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<SecureProviderForm onSubmit={onSubmit} />);
    
    // Fill out form with valid data
    await user.type(screen.getByLabelText(/Provider Name/), 'Test Provider');
    await user.type(screen.getByLabelText(/Provider Slug/), 'test-provider');
    
    // Submit form
    await user.click(screen.getByText('Submit'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Provider',
          slug: 'test-provider',
        })
      );
    });
  });

  it('should reject invalid form inputs', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<SecureProviderForm onSubmit={onSubmit} />);
    
    // Fill out form with invalid data
    await user.type(screen.getByLabelText(/Provider Name/), '<script>alert("xss")</script>');
    await user.type(screen.getByLabelText(/Provider Slug/), 'Invalid Slug!');
    
    // Submit form
    await user.click(screen.getByText('Submit'));
    
    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/contains invalid characters/)).toBeInTheDocument();
    });
    
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
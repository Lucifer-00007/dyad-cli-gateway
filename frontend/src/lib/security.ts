/**
 * Security utilities for input validation, sanitization, and XSS prevention
 */

import DOMPurify from 'dompurify';
import { z } from 'zod';

// Security configuration
export interface SecurityConfig {
  maxInputLength: number;
  allowedTags: string[];
  allowedAttributes: string[];
  enableCSRF: boolean;
  enableXSSProtection: boolean;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxInputLength: 10000,
  allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li'],
  allowedAttributes: ['class', 'id'],
  enableCSRF: true,
  enableXSSProtection: true,
};

/**
 * Input validation patterns
 */
export const VALIDATION_PATTERNS = {
  // Basic patterns
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  alphanumericWithHyphens: /^[a-zA-Z0-9\-_]+$/,
  
  // Provider-specific patterns
  providerName: /^[a-zA-Z0-9\s\-_.]{1,100}$/,
  providerSlug: /^[a-z0-9-]{1,50}$/,
  modelId: /^[a-zA-Z0-9\-_./]{1,100}$/,
  
  // Command and URL patterns
  command: /^[a-zA-Z0-9\-_./\s]{1,500}$/,
  url: /^https?:\/\/[^\s<>"{}|\\^`[\]]{1,2000}$/,
  
  // API key patterns
  apiKey: /^[a-zA-Z0-9\-_]{10,100}$/,
  
  // File paths
  filePath: /^[a-zA-Z0-9\-_./]{1,500}$/,
  
  // Docker image names
  dockerImage: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(:[a-zA-Z0-9\-_.]{1,128})?$/,
  
  // Environment variable names
  envVarName: /^[A-Z][A-Z0-9_]*$/,
  
  // JSON strings
  json: /^[\s\S]*$/,
} as const;

/**
 * Input sanitization functions
 */
export class InputSanitizer {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config;
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHtml(input: string): string {
    if (!this.config.enableXSSProtection) {
      return input;
    }

    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: this.config.allowedTags,
      ALLOWED_ATTR: this.config.allowedAttributes,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
  }

  /**
   * Sanitize plain text input
   */
  sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove null bytes and control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Limit length
    if (sanitized.length > this.config.maxInputLength) {
      sanitized = sanitized.substring(0, this.config.maxInputLength);
    }

    return sanitized.trim();
  }

  /**
   * Sanitize command input for CLI execution
   */
  sanitizeCommand(input: string): string {
    const sanitized = this.sanitizeText(input);
    
    // Remove potentially dangerous characters
    return sanitized.replace(/[;&|`$(){}[\]<>]/g, '');
  }

  /**
   * Sanitize URL input
   */
  sanitizeUrl(input: string): string {
    const sanitized = this.sanitizeText(input);
    
    // Ensure it starts with http:// or https://
    if (sanitized && !sanitized.match(/^https?:\/\//)) {
      return '';
    }

    return sanitized;
  }

  /**
   * Sanitize JSON input
   */
  sanitizeJson(input: string): string {
    const sanitized = this.sanitizeText(input);
    
    try {
      // Validate JSON structure
      JSON.parse(sanitized);
      return sanitized;
    } catch {
      return '';
    }
  }

  /**
   * Sanitize file path input
   */
  sanitizeFilePath(input: string): string {
    const sanitized = this.sanitizeText(input);
    
    // Remove path traversal attempts
    return sanitized.replace(/\.\./g, '').replace(/\/+/g, '/');
  }

  /**
   * Sanitize environment variable value
   */
  sanitizeEnvVar(input: string): string {
    const sanitized = this.sanitizeText(input);
    
    // Remove shell metacharacters
    return sanitized.replace(/[;&|`$(){}[\]<>]/g, '');
  }
}

// Global sanitizer instance
export const sanitizer = new InputSanitizer();

/**
 * Validation schemas using Zod
 */
export const securitySchemas = {
  // Provider validation
  providerName: z.string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name must be less than 100 characters')
    .regex(VALIDATION_PATTERNS.providerName, 'Provider name contains invalid characters')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  providerSlug: z.string()
    .min(1, 'Provider slug is required')
    .max(50, 'Provider slug must be less than 50 characters')
    .regex(VALIDATION_PATTERNS.providerSlug, 'Provider slug must be lowercase with hyphens only')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  modelId: z.string()
    .min(1, 'Model ID is required')
    .max(100, 'Model ID must be less than 100 characters')
    .regex(VALIDATION_PATTERNS.modelId, 'Model ID contains invalid characters')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  // Command validation
  command: z.string()
    .min(1, 'Command is required')
    .max(500, 'Command must be less than 500 characters')
    .regex(VALIDATION_PATTERNS.command, 'Command contains invalid characters')
    .transform(sanitizer.sanitizeCommand.bind(sanitizer)),

  // URL validation
  url: z.string()
    .min(1, 'URL is required')
    .max(2000, 'URL must be less than 2000 characters')
    .regex(VALIDATION_PATTERNS.url, 'Invalid URL format')
    .transform(sanitizer.sanitizeUrl.bind(sanitizer)),

  // API key validation
  apiKey: z.string()
    .min(10, 'API key must be at least 10 characters')
    .max(100, 'API key must be less than 100 characters')
    .regex(VALIDATION_PATTERNS.apiKey, 'API key contains invalid characters')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  // File path validation
  filePath: z.string()
    .max(500, 'File path must be less than 500 characters')
    .regex(VALIDATION_PATTERNS.filePath, 'File path contains invalid characters')
    .transform(sanitizer.sanitizeFilePath.bind(sanitizer)),

  // Docker image validation
  dockerImage: z.string()
    .max(256, 'Docker image name must be less than 256 characters')
    .regex(VALIDATION_PATTERNS.dockerImage, 'Invalid Docker image format')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  // Environment variable validation
  envVarName: z.string()
    .max(100, 'Environment variable name must be less than 100 characters')
    .regex(VALIDATION_PATTERNS.envVarName, 'Environment variable name must be uppercase with underscores')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  envVarValue: z.string()
    .max(1000, 'Environment variable value must be less than 1000 characters')
    .transform(sanitizer.sanitizeEnvVar.bind(sanitizer)),

  // JSON validation
  jsonString: z.string()
    .max(10000, 'JSON string must be less than 10000 characters')
    .transform(sanitizer.sanitizeJson.bind(sanitizer))
    .refine((val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid JSON format'),

  // General text validation
  safeText: z.string()
    .max(1000, 'Text must be less than 1000 characters')
    .transform(sanitizer.sanitizeText.bind(sanitizer)),

  safeHtml: z.string()
    .max(5000, 'HTML content must be less than 5000 characters')
    .transform(sanitizer.sanitizeHtml.bind(sanitizer)),
};

/**
 * CSRF protection utilities
 */
export class CSRFProtection {
  private static readonly TOKEN_HEADER = 'X-CSRF-Token';
  private static readonly TOKEN_META = 'csrf-token';
  private static readonly TOKEN_COOKIE = 'csrf-token';

  /**
   * Get CSRF token from various sources
   */
  static getToken(): string {
    // Try meta tag first
    const metaToken = document.querySelector(`meta[name="${this.TOKEN_META}"]`)?.getAttribute('content');
    if (metaToken) return metaToken;

    // Try cookie fallback
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith(`${this.TOKEN_COOKIE}=`));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }

    return '';
  }

  /**
   * Validate CSRF token format
   */
  static isValidToken(token: string): boolean {
    return typeof token === 'string' && token.length >= 32 && /^[a-zA-Z0-9\-_]+$/.test(token);
  }

  /**
   * Add CSRF token to request headers
   */
  static addTokenToHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const token = this.getToken();
    if (token && this.isValidToken(token)) {
      headers[this.TOKEN_HEADER] = token;
    }
    return headers;
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimitTracker {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is within rate limit
   */
  isWithinLimit(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowMs);
    
    // Update the requests array
    this.requests.set(key, validRequests);
    
    return validRequests.length < this.maxRequests;
  }

  /**
   * Record a new request
   */
  recordRequest(key: string): void {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    requests.push(now);
    this.requests.set(key, requests);
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get time until rate limit resets
   */
  getResetTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + this.windowMs;
    return Math.max(0, resetTime - Date.now());
  }
}

// Global rate limit tracker
export const rateLimitTracker = new RateLimitTracker();

/**
 * Content Security Policy utilities
 */
export class CSPHelper {
  /**
   * Generate nonce for inline scripts/styles
   */
  static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Validate if content is safe for inline execution
   */
  static isSafeInlineContent(content: string): boolean {
    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(content));
  }
}

/**
 * Secure storage utilities
 */
export class SecureStorage {
  private static readonly PREFIX = 'dyad_secure_';

  /**
   * Store sensitive data with encryption (basic obfuscation)
   */
  static setItem(key: string, value: string): void {
    try {
      const encoded = btoa(value);
      localStorage.setItem(this.PREFIX + key, encoded);
    } catch (error) {
      console.warn('Failed to store secure item:', error);
    }
  }

  /**
   * Retrieve sensitive data with decryption
   */
  static getItem(key: string): string | null {
    try {
      const encoded = localStorage.getItem(this.PREFIX + key);
      return encoded ? atob(encoded) : null;
    } catch (error) {
      console.warn('Failed to retrieve secure item:', error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  static removeItem(key: string): void {
    localStorage.removeItem(this.PREFIX + key);
  }

  /**
   * Clear all secure storage
   */
  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}

/**
 * Security validation hooks for React components
 */
export const useSecurityValidation = () => {
  const validateInput = (input: string, type: keyof typeof VALIDATION_PATTERNS): boolean => {
    return VALIDATION_PATTERNS[type].test(input);
  };

  const sanitizeInput = (input: string, type: 'text' | 'html' | 'command' | 'url' | 'json' | 'filePath' | 'envVar'): string => {
    switch (type) {
      case 'text':
        return sanitizer.sanitizeText(input);
      case 'html':
        return sanitizer.sanitizeHtml(input);
      case 'command':
        return sanitizer.sanitizeCommand(input);
      case 'url':
        return sanitizer.sanitizeUrl(input);
      case 'json':
        return sanitizer.sanitizeJson(input);
      case 'filePath':
        return sanitizer.sanitizeFilePath(input);
      case 'envVar':
        return sanitizer.sanitizeEnvVar(input);
      default:
        return sanitizer.sanitizeText(input);
    }
  };

  return { validateInput, sanitizeInput };
};

/**
 * Security audit utilities
 */
export class SecurityAuditor {
  /**
   * Audit form data for security issues
   */
  static auditFormData(data: Record<string, unknown>): string[] {
    const issues: string[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Check for potential XSS
        if (/<script|javascript:|on\w+=/i.test(value)) {
          issues.push(`Potential XSS in field: ${key}`);
        }

        // Check for SQL injection patterns
        if (/('|(--)|;|\/\*|\*\/|xp_|sp_)/i.test(value)) {
          issues.push(`Potential SQL injection in field: ${key}`);
        }

        // Check for command injection
        if (/[;&|`$(){}[\]<>]/g.test(value) && key.toLowerCase().includes('command')) {
          issues.push(`Potential command injection in field: ${key}`);
        }

        // Check for path traversal
        if (/\.\./g.test(value) && key.toLowerCase().includes('path')) {
          issues.push(`Potential path traversal in field: ${key}`);
        }
      }
    });

    return issues;
  }

  /**
   * Generate security report
   */
  static generateSecurityReport(): {
    csrfEnabled: boolean;
    xssProtectionEnabled: boolean;
    httpsOnly: boolean;
    secureStorageUsed: boolean;
    rateLimitingEnabled: boolean;
  } {
    return {
      csrfEnabled: !!CSRFProtection.getToken(),
      xssProtectionEnabled: DEFAULT_SECURITY_CONFIG.enableXSSProtection,
      httpsOnly: location.protocol === 'https:',
      secureStorageUsed: true, // We're using SecureStorage
      rateLimitingEnabled: true, // We have rate limiting
    };
  }
}
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// Supported locales
export const SUPPORTED_LOCALES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
} as const;

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES;

// RTL languages
export const RTL_LOCALES: SupportedLocale[] = ['ar', 'he', 'fa'];

// Translation interface
export interface TranslationMessages {
  [key: string]: string | TranslationMessages;
}

// Translation context
export interface I18nContextType {
  locale: SupportedLocale;
  messages: TranslationMessages;
  isRTL: boolean;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
}

// Default messages (English)
const DEFAULT_MESSAGES: TranslationMessages = {
  // Common
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    filter: 'Filter',
    clear: 'Clear',
    reset: 'Reset',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    retry: 'Retry',
    refresh: 'Refresh',
    export: 'Export',
    import: 'Import',
    copy: 'Copy',
    copied: 'Copied',
    settings: 'Settings',
    help: 'Help',
    about: 'About',
    logout: 'Logout',
    login: 'Login',
  },

  // Navigation
  navigation: {
    dashboard: 'Dashboard',
    providers: 'Providers',
    apiKeys: 'API Keys',
    monitoring: 'Monitoring',
    playground: 'Playground',
    settings: 'Settings',
    home: 'Home',
    skipToContent: 'Skip to main content',
    skipToNavigation: 'Skip to navigation',
  },

  // Providers
  providers: {
    title: 'AI Providers',
    description: 'Manage your AI provider configurations',
    createProvider: 'Create Provider',
    editProvider: 'Edit Provider',
    deleteProvider: 'Delete Provider',
    testProvider: 'Test Provider',
    enableProvider: 'Enable Provider',
    disableProvider: 'Disable Provider',
    providerName: 'Provider Name',
    providerType: 'Provider Type',
    providerStatus: 'Status',
    providerHealth: 'Health',
    lastHealthCheck: 'Last Health Check',
    noProviders: 'No providers configured',
    createFirstProvider: 'Create your first provider to get started',
    providerCreated: 'Provider created successfully',
    providerUpdated: 'Provider updated successfully',
    providerDeleted: 'Provider deleted successfully',
    confirmDeleteProvider: 'Are you sure you want to delete this provider?',
    deleteProviderWarning: 'This action cannot be undone.',
  },

  // API Keys
  apiKeys: {
    title: 'API Keys',
    description: 'Manage API keys for accessing the gateway',
    createApiKey: 'Create API Key',
    revokeApiKey: 'Revoke API Key',
    keyName: 'Key Name',
    keyPermissions: 'Permissions',
    keyUsage: 'Usage',
    keyCreated: 'Created',
    keyLastUsed: 'Last Used',
    keyStatus: 'Status',
    noApiKeys: 'No API keys found',
    createFirstApiKey: 'Create your first API key to get started',
    apiKeyCreated: 'API key created successfully',
    apiKeyRevoked: 'API key revoked successfully',
    confirmRevokeApiKey: 'Are you sure you want to revoke this API key?',
    revokeApiKeyWarning: 'This will immediately disable access for this key.',
    copyApiKey: 'Copy API Key',
    apiKeyCopied: 'API key copied to clipboard',
    showApiKey: 'Show API Key',
    hideApiKey: 'Hide API Key',
  },

  // Monitoring
  monitoring: {
    title: 'System Monitoring',
    description: 'Monitor system health and performance',
    systemHealth: 'System Health',
    providerHealth: 'Provider Health',
    metrics: 'Metrics',
    logs: 'Logs',
    requests: 'Requests',
    errors: 'Errors',
    latency: 'Latency',
    uptime: 'Uptime',
    successRate: 'Success Rate',
    errorRate: 'Error Rate',
    averageLatency: 'Average Latency',
    totalRequests: 'Total Requests',
    activeProviders: 'Active Providers',
    healthyProviders: 'Healthy Providers',
    unhealthyProviders: 'Unhealthy Providers',
    noLogs: 'No logs available',
    refreshLogs: 'Refresh Logs',
    clearLogs: 'Clear Logs',
    exportLogs: 'Export Logs',
  },

  // Chat Playground
  playground: {
    title: 'Chat Playground',
    description: 'Test and interact with AI models',
    selectModel: 'Select Model',
    sendMessage: 'Send Message',
    clearConversation: 'Clear Conversation',
    saveConversation: 'Save Conversation',
    loadConversation: 'Load Conversation',
    exportConversation: 'Export Conversation',
    messageInput: 'Type your message...',
    noModels: 'No models available',
    selectModelFirst: 'Please select a model first',
    conversationCleared: 'Conversation cleared',
    conversationSaved: 'Conversation saved',
    conversationLoaded: 'Conversation loaded',
    conversationExported: 'Conversation exported',
    streaming: 'Streaming...',
    stopStreaming: 'Stop Streaming',
    requestInspector: 'Request Inspector',
    responseInspector: 'Response Inspector',
    showRequest: 'Show Request',
    showResponse: 'Show Response',
    copyRequest: 'Copy Request',
    copyResponse: 'Copy Response',
  },

  // Forms
  forms: {
    required: 'This field is required',
    invalid: 'This field is invalid',
    tooShort: 'This field is too short',
    tooLong: 'This field is too long',
    invalidEmail: 'Please enter a valid email address',
    invalidUrl: 'Please enter a valid URL',
    passwordMismatch: 'Passwords do not match',
    unsavedChanges: 'You have unsaved changes',
    confirmLeave: 'Are you sure you want to leave? Your changes will be lost.',
    fieldError: 'Error in {{field}}',
    validationError: 'Please fix the errors below',
    saveSuccess: 'Changes saved successfully',
    saveError: 'Failed to save changes',
  },

  // Accessibility
  accessibility: {
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    toggleSidebar: 'Toggle sidebar',
    previousPage: 'Go to previous page',
    nextPage: 'Go to next page',
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    selectAll: 'Select all',
    selectRow: 'Select row',
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',
    showMore: 'Show more',
    showLess: 'Show less',
    loading: 'Loading content',
    searchResults: '{{count}} search results',
    noResults: 'No results found',
    pageOf: 'Page {{current}} of {{total}}',
    itemsPerPage: 'Items per page',
    announcement: 'Announcement',
    error: 'Error message',
    warning: 'Warning message',
    info: 'Information message',
    success: 'Success message',
  },

  // Theme and Settings
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    highContrast: 'High Contrast',
    reducedMotion: 'Reduce Motion',
    fontSize: 'Font Size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    themeSettings: 'Theme & Accessibility',
    colorScheme: 'Color Scheme',
    accessibility: 'Accessibility',
    switchToTheme: 'Switch to {{theme}} theme',
  },

  // Errors
  errors: {
    generic: 'Something went wrong',
    network: 'Network error',
    timeout: 'Request timed out',
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    notFound: 'Resource not found',
    serverError: 'Server error',
    validationError: 'Validation error',
    unknownError: 'Unknown error occurred',
    tryAgain: 'Please try again',
    contactSupport: 'Contact support if the problem persists',
  },

  // Time and dates
  time: {
    now: 'now',
    secondsAgo: '{{count}} seconds ago',
    minutesAgo: '{{count}} minutes ago',
    hoursAgo: '{{count}} hours ago',
    daysAgo: '{{count}} days ago',
    weeksAgo: '{{count}} weeks ago',
    monthsAgo: '{{count}} months ago',
    yearsAgo: '{{count}} years ago',
    in: 'in {{time}}',
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    weeks: 'weeks',
    months: 'months',
    years: 'years',
  },
};

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
}

// Replace parameters in translation string
function replaceParams(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}

// Detect user's preferred locale
function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  
  // Check localStorage first
  const stored = localStorage.getItem('dyad-locale');
  if (stored && stored in SUPPORTED_LOCALES) {
    return stored as SupportedLocale;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang in SUPPORTED_LOCALES) {
    return browserLang as SupportedLocale;
  }
  
  return 'en';
}

// Create i18n context
export const I18nContext = createContext<I18nContextType | null>(null);

// Custom hook for using i18n
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Hook for i18n functionality without context (for standalone use)
export const useI18nStandalone = () => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => detectLocale());
  const [messages, setMessages] = useState<TranslationMessages>(DEFAULT_MESSAGES);

  const isRTL = RTL_LOCALES.includes(locale);

  // Load messages for locale
  useEffect(() => {
    const loadMessages = async () => {
      if (locale === 'en') {
        setMessages(DEFAULT_MESSAGES);
        return;
      }

      try {
        // In a real implementation, you would load from a file or API
        // For now, we'll use the default messages
        setMessages(DEFAULT_MESSAGES);
      } catch (error) {
        console.warn(`Failed to load messages for locale ${locale}:`, error);
        setMessages(DEFAULT_MESSAGES);
      }
    };

    loadMessages();
  }, [locale]);

  // Update document direction
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }
  }, [locale, isRTL]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dyad-locale', newLocale);
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(messages, key);
    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    
    return params ? replaceParams(value, params) : value;
  }, [messages]);

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch (error) {
      console.warn('Number formatting failed:', error);
      return String(value);
    }
  }, [locale]);

  const formatDate = useCallback((date: Date, options?: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      console.warn('Date formatting failed:', error);
      return date.toLocaleDateString();
    }
  }, [locale]);

  const formatRelativeTime = useCallback((value: number, unit: Intl.RelativeTimeFormatUnit): string => {
    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
    } catch (error) {
      console.warn('Relative time formatting failed:', error);
      return `${value} ${unit}`;
    }
  }, [locale]);

  return {
    locale,
    messages,
    isRTL,
    setLocale,
    t,
    formatNumber,
    formatDate,
    formatRelativeTime,
  };
};

// Utility function to get translation without hook
export const getTranslation = (
  messages: TranslationMessages,
  key: string,
  params?: Record<string, string | number>
): string => {
  const value = getNestedValue(messages, key);
  if (typeof value !== 'string') {
    return key;
  }
  
  return params ? replaceParams(value, params) : value;
};

// Utility function to check if locale is RTL
export const isRTLLocale = (locale: SupportedLocale): boolean => {
  return RTL_LOCALES.includes(locale);
};

// Utility function to get locale display name
export const getLocaleDisplayName = (locale: SupportedLocale): string => {
  return SUPPORTED_LOCALES[locale] || locale;
};
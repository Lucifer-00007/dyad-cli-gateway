export const APP_CONSTANTS = {
  ROUTES: {
    HOME: '/',
    PROVIDERS: '/providers',
    MONITORING: '/monitoring',
    API_KEYS: '/api-keys',
    CHAT: '/chat',
    SETTINGS: '/settings',
    NOT_FOUND: '*',
  },
  MESSAGES: {
    WELCOME_TITLE: 'Welcome to Dyad Gateway Admin',
    WELCOME_SUBTITLE: 'Manage your AI providers and monitor system health',
    NOT_FOUND_TITLE: '404',
    NOT_FOUND_MESSAGE: 'Oops! Page not found',
    RETURN_HOME: 'Return to Home',
    ERROR_404_LOG: '404 Error: User attempted to access non-existent route:',
  },
} as const;

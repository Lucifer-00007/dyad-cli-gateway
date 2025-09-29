/**
 * PWA utilities for service worker management and offline support
 */

import { Workbox } from 'workbox-window';

interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAManager {
  private wb: Workbox | null = null;
  private installPrompt: PWAInstallPrompt | null = null;
  private isOnline = navigator.onLine;
  private updateAvailable = false;

  constructor() {
    this.initializeServiceWorker();
    this.setupInstallPrompt();
    this.setupOnlineOfflineHandlers();
  }

  private initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      this.wb = new Workbox('/sw.js');

      // Service worker update available
      this.wb.addEventListener('waiting', () => {
        this.updateAvailable = true;
        this.showUpdatePrompt();
      });

      // Service worker activated
      this.wb.addEventListener('controlling', () => {
        window.location.reload();
      });

      // Service worker installed for the first time
      this.wb.addEventListener('installed', (event) => {
        if (!event.isUpdate) {
          this.showOfflineReadyMessage();
        }
      });

      // Register the service worker
      this.wb.register().catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    }
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as PWAInstallPrompt;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.hideInstallButton();
      this.trackEvent('pwa_installed');
    });
  }

  private setupOnlineOfflineHandlers() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showOnlineMessage();
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineMessage();
    });
  }

  // Public methods
  public async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const { outcome } = await this.installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        this.trackEvent('pwa_install_accepted');
        return true;
      } else {
        this.trackEvent('pwa_install_dismissed');
        return false;
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  public async updateApp(): Promise<void> {
    if (!this.wb || !this.updateAvailable) {
      return;
    }

    try {
      await this.wb.messageSkipWaiting();
      this.trackEvent('pwa_updated');
    } catch (error) {
      console.error('Update failed:', error);
    }
  }

  public isInstallable(): boolean {
    return this.installPrompt !== null;
  }

  public isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  public isAppOnline(): boolean {
    return this.isOnline;
  }

  // Cache management
  public async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      this.trackEvent('cache_cleared');
    }
  }

  public async getCacheSize(): Promise<number> {
    if (!('caches' in window) || !('storage' in navigator) || !('estimate' in navigator.storage)) {
      return 0;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  // Offline data sync
  private async syncOfflineData(): Promise<void> {
    // Implement offline data synchronization logic here
    // This would typically involve:
    // 1. Checking for pending offline actions
    // 2. Retrying failed API requests
    // 3. Syncing cached data with server
    
    try {
      const pendingActions = this.getPendingOfflineActions();
      for (const action of pendingActions) {
        await this.retryAction(action);
      }
      this.clearPendingActions();
    } catch (error) {
      console.error('Offline sync failed:', error);
    }
  }

  private getPendingOfflineActions(): OfflineAction[] {
    try {
      const stored = localStorage.getItem('dyad_offline_actions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async retryAction(action: OfflineAction): Promise<void> {
    // Implement retry logic for offline actions
    // This would depend on your specific API structure
    console.log('Retrying offline action:', action);
  }

  private clearPendingActions(): void {
    localStorage.removeItem('dyad_offline_actions');
  }

  // UI feedback methods
  private showUpdatePrompt(): void {
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  }

  private showInstallButton(): void {
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  }

  private hideInstallButton(): void {
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  }

  private showOfflineMessage(): void {
    window.dispatchEvent(new CustomEvent('pwa-offline'));
  }

  private showOnlineMessage(): void {
    window.dispatchEvent(new CustomEvent('pwa-online'));
  }

  private showOfflineReadyMessage(): void {
    window.dispatchEvent(new CustomEvent('pwa-offline-ready'));
  }

  // Analytics
  private trackEvent(event: string): void {
    // Implement analytics tracking
    console.log('PWA Event:', event);
    
    // Example: Send to analytics service
    if (window.gtag) {
      window.gtag('event', event, {
        event_category: 'PWA',
        event_label: navigator.userAgent,
      });
    }
  }
}

// Singleton instance
export const pwaManager = new PWAManager();

// React hook for PWA functionality
export function usePWA() {
  const [isInstallable, setIsInstallable] = React.useState(pwaManager.isInstallable());
  const [isUpdateAvailable, setIsUpdateAvailable] = React.useState(pwaManager.isUpdateAvailable());
  const [isOnline, setIsOnline] = React.useState(pwaManager.isAppOnline());
  const [cacheSize, setCacheSize] = React.useState(0);

  React.useEffect(() => {
    const handleInstallable = () => setIsInstallable(true);
    const handleInstalled = () => setIsInstallable(false);
    const handleUpdateAvailable = () => setIsUpdateAvailable(true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-online', handleOnline);
    window.addEventListener('pwa-offline', handleOffline);

    // Get initial cache size
    pwaManager.getCacheSize().then(setCacheSize);

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
      window.removeEventListener('pwa-installed', handleInstalled);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-online', handleOnline);
      window.removeEventListener('pwa-offline', handleOffline);
    };
  }, []);

  return {
    isInstallable,
    isUpdateAvailable,
    isOnline,
    cacheSize,
    installApp: () => pwaManager.installApp(),
    updateApp: () => pwaManager.updateApp(),
    clearCache: () => pwaManager.clearCache(),
    getCacheSize: () => pwaManager.getCacheSize().then(setCacheSize),
  };
}

// Offline storage utilities
export class OfflineStorage {
  private static readonly STORAGE_KEY = 'dyad_offline_data';
  private static readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB

  static async store(key: string, data: unknown): Promise<boolean> {
    try {
      const stored = this.getAll();
      stored[key] = {
        data,
        timestamp: Date.now(),
        size: JSON.stringify(data).length,
      };

      // Check storage size limit
      const totalSize = Object.values(stored).reduce((sum, item: StoredItem) => sum + item.size, 0);
      if (totalSize > this.MAX_STORAGE_SIZE) {
        this.cleanup(stored);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
      return true;
    } catch (error) {
      console.error('Failed to store offline data:', error);
      return false;
    }
  }

  static get(key: string): unknown | null {
    try {
      const stored = this.getAll();
      return stored[key]?.data || null;
    } catch {
      return null;
    }
  }

  static remove(key: string): void {
    try {
      const stored = this.getAll();
      delete stored[key];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to remove offline data:', error);
    }
  }

  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private static getAll(): Record<string, StoredItem> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private static cleanup(stored: Record<string, StoredItem>): void {
    // Remove oldest entries until under size limit
    const entries = Object.entries(stored).sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    let totalSize = Object.values(stored).reduce((sum, item) => sum + item.size, 0);
    
    for (const [key] of entries) {
      if (totalSize <= this.MAX_STORAGE_SIZE * 0.8) break; // Keep 20% buffer
      
      totalSize -= stored[key].size;
      delete stored[key];
    }
  }
}

// Type definitions
interface OfflineAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

interface StoredItem {
  data: unknown;
  timestamp: number;
  size: number;
}

// Type declarations for global objects
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Import React for the hook
import React from 'react';
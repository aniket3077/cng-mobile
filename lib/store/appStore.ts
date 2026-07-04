import { create } from 'zustand';
import { appStorage } from '../appStorage';
import { authStorage } from '../auth';
import { authApi, customerProfileApi } from '../api';
import { logger } from '../logger';
import { storageKeys } from '../storageKeys';

type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppStoreState {
  bootStatus: BootStatus;
  bootError: string | null;
  isAuthenticated: boolean;
  hasSubscription: boolean;
  isFirstLaunch: boolean | null;
  initializeApp: () => Promise<void>;
  refreshAccessState: () => Promise<void>;
  refreshSubscription: () => Promise<boolean>;
  setAuthenticated: (value: boolean) => void;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  bootStatus: 'idle',
  bootError: null,
  isAuthenticated: false,
  hasSubscription: false,
  isFirstLaunch: null,

  async initializeApp() {
    set({ bootStatus: 'loading', bootError: null });

    try {
      const launchFlag = await appStorage.getItem(storageKeys.onboardingCompleted);
      set({ isFirstLaunch: launchFlag !== 'true' });
      await get().refreshAccessState();
      set({ bootStatus: 'ready' });
    } catch (error) {
      logger.error('App bootstrap failed', error);
      set({
        bootStatus: 'error',
        bootError: error instanceof Error ? error.message : 'Unable to start the app securely.',
      });
    }
  },

  async refreshAccessState() {
    const authenticated = await authStorage.isAuthenticated();

    if (!authenticated) {
      try {
        const refreshedToken = await authApi.refreshToken();
        if (refreshedToken) {
          set({ isAuthenticated: true });
          await get().refreshSubscription();
          return;
        }
      } catch (error) {
        logger.warn('Session refresh failed', error);
      }

      set({
        isAuthenticated: false,
        hasSubscription: false,
      });
      return;
    }

    set({ isAuthenticated: true });
    await get().refreshSubscription();
  },

  async refreshSubscription() {
    try {
      const subscriptionStatus = await customerProfileApi.getSubscriptionStatus();
      const hasSubscription = Boolean(subscriptionStatus?.subscription?.isActive);
      set({ hasSubscription });
      return hasSubscription;
    } catch (error) {
      logger.warn('Subscription refresh failed', error);
      set({ hasSubscription: false });
      return false;
    }
  },

  setAuthenticated(value) {
    set({
      isAuthenticated: value,
      hasSubscription: value ? get().hasSubscription : false,
    });
  },

  async completeOnboarding() {
    await appStorage.setItem(storageKeys.onboardingCompleted, 'true');
    set({ isFirstLaunch: false });
  },

  async logout() {
    await authStorage.clearAuth();
    set({
      isAuthenticated: false,
      hasSubscription: false,
    });
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { secureStorage } from './secureStorage';
import { storageKeys } from './storageKeys';

const REFRESH_TOKEN_KEY = 'refreshToken';

const refreshTokenStorageOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Decode a JWT payload without a library (reads the base64url middle segment). */
function decodeJwtExp(token: string): number | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    // base64url → standard base64
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export const authStorage = {
  /**
   * Save authentication token
   */
  async saveToken(token: string): Promise<void> {
    await secureStorage.setItem(storageKeys.authToken, token);
  },

  async saveRefreshToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, refreshTokenStorageOptions);
  },

  async saveSession(token: string, refreshToken: string): Promise<void> {
    await authStorage.saveToken(token);
    await authStorage.saveRefreshToken(refreshToken);
  },

  /**
   * Get authentication token
   */
  async getToken(): Promise<string | null> {
    return secureStorage.getItem(storageKeys.authToken);
  },

  async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    }

    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, refreshTokenStorageOptions);
  },

  /**
   * Save user data
   */
  async saveUser(user: any): Promise<void> {
    // User data is not highly sensitive, but we can store it securely too
    const userStr = JSON.stringify(user);
    await secureStorage.setItem(storageKeys.user, userStr);
  },

  /**
   * Get user data
   */
  async getUser(): Promise<any | null> {
    const userData = await secureStorage.getItem(storageKeys.user);
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Check if user is authenticated AND the token is not expired.
   * Decodes the JWT exp claim locally — no network call needed.
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    const exp = decodeJwtExp(token);
    if (exp === null) {
      return false;
    }

    const nowSec = Date.now() / 1000;
    if (nowSec >= exp) {
      return false;
    }

    return true;
  },

  /**
   * Clear all auth data (logout)
   */
  async clearAuth(): Promise<void> {
    await secureStorage.multiRemove([
      storageKeys.authToken,
      storageKeys.refreshToken,
      storageKeys.user,
    ]);
    await AsyncStorage.removeItem(storageKeys.profileImage);
  },
};


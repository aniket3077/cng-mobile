import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'user';

// PRODUCTION NOTE:
// For better security, use expo-secure-store instead of AsyncStorage:
// import * as SecureStore from 'expo-secure-store';
// SecureStore provides encrypted storage for sensitive data

export const authStorage = {
  /**
   * Save authentication token
   */
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  /**
   * Get authentication token
   */
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },

  /**
   * Save user data
   */
  async saveUser(user: any): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /**
   * Get user data
   */
  async getUser(): Promise<any | null> {
    const userData = await AsyncStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },

  /**
   * Clear all auth data (logout)
   */
  async clearAuth(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};

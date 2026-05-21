import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key) => mockAsyncStorage.getItem(key)),
  setItemAsync: jest.fn(async (key, value) => mockAsyncStorage.setItem(key, value)),
  deleteItemAsync: jest.fn(async (key) => mockAsyncStorage.removeItem(key)),
}));
jest.mock('expo-application', () => ({
  applicationId: 'com.cngbharat.mobile',
  getAndroidId: jest.fn(() => 'android-device-id'),
  getIosIdForVendorAsync: jest.fn(async () => 'ios-vendor-id'),
}));
jest.mock('expo-device', () => ({
  brand: 'Google',
  manufacturer: 'Google',
  modelId: 'Pixel-8',
  modelName: 'Pixel 8',
  osName: 'Android',
  osVersion: '14',
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm, value) => `hash_${value}`),
}));

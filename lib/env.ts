import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

type MobileEnv = {
  apiUrl: string;
  appEnv: 'development' | 'staging' | 'production';
  enableDevPaymentSimulation: boolean;
  enableVoiceDemoQueries: boolean;
  sslPins?: string;
};

function normalizeBoolean(value: string | undefined) {
  return value === 'true';
}

function getDevHostIp(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  return null;
}

function normalizeApiUrl(value: string | undefined) {
  let normalized = value?.trim().replace(/\/+$/, '').replace(/\/api$/, '') || '';
  if (!normalized) {
    return '';
  }

  // Prepend https:// if user provided a bare domain e.g. api.cngbharat.com
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // Handle localhost / 127.0.0.1 on real devices and emulators in dev mode
  if (__DEV__ && (normalized.includes('://localhost') || normalized.includes('://127.0.0.1'))) {
    if (Platform.OS === 'android' && !Device.isDevice) {
      // Android emulator uses 10.0.2.2 to access host PC
      normalized = normalized
        .replace('://localhost', '://10.0.2.2')
        .replace('://127.0.0.1', '://10.0.2.2');
    } else {
      // Physical device: localhost points to the phone, not PC.
      // Auto-detect PC IP from Expo Metro bundler host.
      const hostIp = getDevHostIp();
      if (hostIp) {
        normalized = normalized
          .replace('://localhost', `://${hostIp}`)
          .replace('://127.0.0.1', `://${hostIp}`);
      }
    }
  }

  return normalized;
}

const DEFAULT_API_URL = 'https://api.cngbharat.com';

function buildMobileEnv(): MobileEnv {
  const apiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL) || DEFAULT_API_URL;
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production')) as MobileEnv['appEnv'];

  // Warn in dev if API URL is not configured.
  if (!process.env.EXPO_PUBLIC_API_URL && __DEV__) {
    console.warn('Warning: EXPO_PUBLIC_API_URL is not set. API calls will fail.');
  }

  return {
    apiUrl,
    appEnv,
    enableDevPaymentSimulation: __DEV__ && normalizeBoolean(process.env.EXPO_PUBLIC_ENABLE_DEV_PAYMENT_SIMULATION),
    enableVoiceDemoQueries: __DEV__ && normalizeBoolean(process.env.EXPO_PUBLIC_ENABLE_VOICE_DEMO_QUERIES),
    // sslPins is consumed by the Android network security config, not by runtime JS.
    sslPins: process.env.EXPO_PUBLIC_SSL_PINS?.trim(),
  };
}

export const mobileEnv = buildMobileEnv();

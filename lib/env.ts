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

function normalizeApiUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/\/+$/, '');
  return normalized || '';
}

function buildMobileEnv(): MobileEnv {
  const apiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL) || 'https://cng-backend.vercel.app';
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production')) as MobileEnv['appEnv'];

  // Defensive fallback to prevent immediate boot crash.
  if (!process.env.EXPO_PUBLIC_API_URL && __DEV__) {
    console.warn('Warning: EXPO_PUBLIC_API_URL is missing. Using fallback production Vercel backend.');
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

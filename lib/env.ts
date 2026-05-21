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
  const apiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production')) as MobileEnv['appEnv'];

  const missing: string[] = [];

  if (!apiUrl) {
    missing.push('EXPO_PUBLIC_API_URL');
  }

  if (missing.length > 0) {
    throw new Error(`Missing mobile environment variables: ${missing.join(', ')}`);
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

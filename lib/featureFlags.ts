import { mobileEnv } from './env';

export const featureFlags = {
  enableDevPaymentSimulation: mobileEnv.enableDevPaymentSimulation,
  enableVoiceDemoQueries: mobileEnv.enableVoiceDemoQueries,
  allowVerboseLogs: __DEV__,
} as const;

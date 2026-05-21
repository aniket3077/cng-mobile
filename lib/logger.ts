import { featureFlags } from './featureFlags';

function shouldLog() {
  return featureFlags.allowVerboseLogs;
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (shouldLog()) {
      console.log(message, meta);
    }
  },
  warn(message: string, meta?: unknown) {
    if (shouldLog()) {
      console.warn(message, meta);
    }
  },
  error(message: string, meta?: unknown) {
    if (shouldLog()) {
      console.error(message, meta);
    }
  },
};

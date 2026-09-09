import { secureStorage } from './secureStorage';
import { storageKeys } from './storageKeys';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordRule {
  label: string;
  met: boolean;
}

export interface PasswordStrengthState {
  color: string;
  isValid: boolean;
  label: string;
  rules: PasswordRule[];
}

export interface PasswordResetSession {
  accountType: 'user' | 'owner';
  deliveryChannel: 'email';
  deliveryTarget: string;
  identifier: string;
  otpExpiresAt: number;
  resendAvailableAt: number;
  sendCount?: number;
  sendWindowStartedAt?: number;
  verifyAttempts?: number;
  otpHash?: string;
  sessionToken?: string;
  resetToken?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: number;
  lastSentAt?: number;
}

export function isEmailIdentifier(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function normalizePhoneIdentifier(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeResetIdentifier(value: string) {
  const trimmedValue = value.trim();

  if (isEmailIdentifier(trimmedValue)) {
    return trimmedValue.toLowerCase();
  }

  return normalizePhoneIdentifier(trimmedValue);
}

export function getResetIdentifierError(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 'Please enter your registered email or mobile number';
  }

  if (isEmailIdentifier(trimmedValue)) {
    return null;
  }

  const normalizedPhone = normalizePhoneIdentifier(trimmedValue);
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    return 'Enter a valid email or mobile number';
  }

  return null;
}

export function sanitizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getPasswordStrength(password: string): PasswordStrengthState {
  const rules: PasswordRule[] = [
    {
      label: 'Exactly 4 digits',
      met: /^\d{4}$/.test(password),
    },
    {
      label: 'Only numbers (0-9)',
      met: /^\d+$/.test(password) && password.length > 0,
    },
  ];

  const isValid = /^\d{4}$/.test(password);

  if (!password.length) {
    return {
      color: '#9CA3AF',
      isValid: false,
      label: 'Enter 4-digit password',
      rules,
    };
  }

  if (isValid) {
    return {
      color: '#059669',
      isValid: true,
      label: 'Valid 4-digit password',
      rules,
    };
  }

  return {
    color: '#DC2626',
    isValid: false,
    label: `${password.length}/4 digits`,
    rules,
  };
}

export const passwordResetStorage = {
  async clearSession() {
    await secureStorage.removeItem(storageKeys.passwordResetSession);
  },

  async getSession(): Promise<PasswordResetSession | null> {
    const serializedSession = await secureStorage.getItem(storageKeys.passwordResetSession);
    if (!serializedSession) {
      return null;
    }

    return JSON.parse(serializedSession) as PasswordResetSession;
  },

  async saveSession(session: PasswordResetSession) {
    await secureStorage.setItem(storageKeys.passwordResetSession, JSON.stringify(session));
  },

  async updateSession(update: Partial<PasswordResetSession>) {
    const currentSession = await passwordResetStorage.getSession();
    if (!currentSession) {
      return null;
    }

    const nextSession = {
      ...currentSession,
      ...update,
    };

    await passwordResetStorage.saveSession(nextSession);
    return nextSession;
  },
};

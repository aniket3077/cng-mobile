import * as SecureStore from 'expo-secure-store';
import {
  isEmailIdentifier,
  normalizePhoneIdentifier,
  normalizeResetIdentifier,
  getResetIdentifierError,
  sanitizeOtp,
  formatTimer,
  getPasswordStrength,
  passwordResetStorage,
  PasswordResetSession
} from './passwordReset';

describe('passwordReset utilities', () => {
  describe('isEmailIdentifier', () => {
    it('should identify valid email addresses', () => {
      expect(isEmailIdentifier('test@example.com')).toBe(true);
      expect(isEmailIdentifier('user.name+tag@domain.co.in')).toBe(true);
      expect(isEmailIdentifier('  spaces@around.com  ')).toBe(true);
    });

    it('should identify invalid email addresses', () => {
      expect(isEmailIdentifier('invalid-email')).toBe(false);
      expect(isEmailIdentifier('test@example')).toBe(false);
      expect(isEmailIdentifier('@domain.com')).toBe(false);
      expect(isEmailIdentifier('testdomain.com')).toBe(false);
    });
  });

  describe('normalizePhoneIdentifier', () => {
    it('should strip out all non-digits', () => {
      expect(normalizePhoneIdentifier('+1 (123) 456-7890')).toBe('11234567890');
      expect(normalizePhoneIdentifier('98765-43210')).toBe('9876543210');
      expect(normalizePhoneIdentifier('123abc456')).toBe('123456');
    });
  });

  describe('normalizeResetIdentifier', () => {
    it('should lowercase and trim email identifiers', () => {
      expect(normalizeResetIdentifier('  TEST@Example.com  ')).toBe('test@example.com');
    });

    it('should normalize phone numbers if it is not an email', () => {
      expect(normalizeResetIdentifier(' +91 999-999-9999 ')).toBe('919999999999');
    });
  });

  describe('getResetIdentifierError', () => {
    it('should return error for empty or blank input', () => {
      expect(getResetIdentifierError('')).toBe('Please enter your registered email or mobile number');
      expect(getResetIdentifierError('   ')).toBe('Please enter your registered email or mobile number');
    });

    it('should return null for valid email input', () => {
      expect(getResetIdentifierError('hello@world.com')).toBeNull();
    });

    it('should return null for valid phone input', () => {
      expect(getResetIdentifierError('1234567890')).toBeNull(); // 10 digits
      expect(getResetIdentifierError('+91-123456789012')).toBeNull(); // 12 digits after normalization
    });

    it('should return error for invalid phone and email inputs', () => {
      expect(getResetIdentifierError('invalid_email_no_at')).toBe('Enter a valid email or mobile number');
      expect(getResetIdentifierError('12345')).toBe('Enter a valid email or mobile number'); // less than 10 digits
      expect(getResetIdentifierError('1234567890123456')).toBe('Enter a valid email or mobile number'); // more than 15 digits
    });
  });

  describe('sanitizeOtp', () => {
    it('should keep only digits and truncate to 6 characters', () => {
      expect(sanitizeOtp('12-34-56')).toBe('123456');
      expect(sanitizeOtp('12345678')).toBe('123456');
      expect(sanitizeOtp('abc123xyz')).toBe('123');
    });
  });

  describe('formatTimer', () => {
    it('should format seconds into MM:SS correctly', () => {
      expect(formatTimer(90)).toBe('1:30');
      expect(formatTimer(5)).toBe('0:05');
      expect(formatTimer(0)).toBe('0:00');
    });

    it('should treat negative seconds as 0:00', () => {
      expect(formatTimer(-10)).toBe('0:00');
    });
  });

  describe('getPasswordStrength', () => {
    it('should return default weak state for empty password', () => {
      const result = getPasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.label).toBe('Add a stronger password');
      expect(result.color).toBe('#9CA3AF');
    });

    it('should detect weak passwords that do not meet rules', () => {
      const result = getPasswordStrength('123');
      expect(result.isValid).toBe(false);
      expect(result.label).toBe('Weak password');
      expect(result.color).toBe('#DC2626');
    });

    it('should detect almost there passwords meeting 3 rules', () => {
      // 8 chars, lowercase, number (meets 3 rules - misses uppercase)
      const result = getPasswordStrength('password123');
      expect(result.isValid).toBe(false);
      expect(result.label).toBe('Almost there');
      expect(result.color).toBe('#D97706');
    });

    it('should detect strong passwords meeting all rules', () => {
      // 8+ chars, uppercase, lowercase, number
      const result = getPasswordStrength('Password123');
      expect(result.isValid).toBe(true);
      expect(result.label).toBe('Strong password');
      expect(result.color).toBe('#059669');
    });
  });

  describe('passwordResetStorage', () => {
    const mockSession: PasswordResetSession = {
      accountType: 'user',
      deliveryChannel: 'email',
      deliveryTarget: 'test@example.com',
      identifier: 'test@example.com',
      otpExpiresAt: 123456789,
      resendAvailableAt: 123456780,
    };

    beforeEach(async () => {
      await SecureStore.deleteItemAsync('passwordResetSession');
      jest.clearAllMocks();
    });

    it('should return null when getting an uninitialized session', async () => {
      const session = await passwordResetStorage.getSession();
      expect(session).toBeNull();
    });

    it('should save and retrieve session successfully', async () => {
      await passwordResetStorage.saveSession(mockSession);
      const session = await passwordResetStorage.getSession();
      expect(session).toEqual(mockSession);
    });

    it('should clear session successfully', async () => {
      await passwordResetStorage.saveSession(mockSession);
      await passwordResetStorage.clearSession();
      const session = await passwordResetStorage.getSession();
      expect(session).toBeNull();
    });

    it('should update session and return the next session state', async () => {
      await passwordResetStorage.saveSession(mockSession);
      const updated = await passwordResetStorage.updateSession({ sendCount: 2 });

      expect(updated).toEqual({
        ...mockSession,
        sendCount: 2,
      });

      const session = await passwordResetStorage.getSession();
      expect(session?.sendCount).toBe(2);
    });

    it('should return null when updating a session that does not exist', async () => {
      const result = await passwordResetStorage.updateSession({ sendCount: 1 });
      expect(result).toBeNull();
    });
  });
});

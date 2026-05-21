import * as SecureStore from 'expo-secure-store';
import { getDeviceFingerprint } from './deviceFingerprint';

describe('getDeviceFingerprint', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('deviceFingerprint');
    jest.clearAllMocks();
  });

  it('should generate a stable fingerprint and save it securely if none exists', async () => {
    const fingerprint = await getDeviceFingerprint();

    expect(fingerprint).toContain('dev_hash_');

    const saved = await SecureStore.getItemAsync('deviceFingerprint');
    expect(saved).toBe(fingerprint);
  });

  it('should return the existing fingerprint if it already exists', async () => {
    const existingFingerprint = 'dev_hash_existing';
    await SecureStore.setItemAsync('deviceFingerprint', existingFingerprint);

    const fingerprint = await getDeviceFingerprint();

    expect(fingerprint).toBe(existingFingerprint);
  });
});

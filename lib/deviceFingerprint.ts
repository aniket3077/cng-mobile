import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { secureStorage } from './secureStorage';
import { storageKeys } from './storageKeys';

async function buildStableDeviceSeed() {
  const applicationId = Application.applicationId || 'unknown-app';
  const nativeIdentifier =
    Platform.OS === 'android'
      ? Application.getAndroidId()
      : Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : `${Device.osName || 'web'}-${Device.osVersion || 'unknown'}`;

  const parts = [
    applicationId,
    Device.brand || 'unknown-brand',
    Device.manufacturer || 'unknown-manufacturer',
    Device.modelId || Device.modelName || 'unknown-model',
    nativeIdentifier || 'unknown-device-id',
  ];

  return parts.join('|');
}

export async function getDeviceFingerprint() {
  const existingFingerprint = await secureStorage.getItem(storageKeys.deviceFingerprint);
  if (existingFingerprint) {
    return existingFingerprint;
  }

  const deviceSeed = await buildStableDeviceSeed();
  const generatedFingerprint = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceSeed,
  );
  const fingerprint = `dev_${generatedFingerprint}`;

  await secureStorage.setItem(storageKeys.deviceFingerprint, fingerprint);
  return fingerprint;
}

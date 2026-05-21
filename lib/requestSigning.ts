import * as Crypto from 'expo-crypto';
import { authStorage } from './auth';
import { getDeviceFingerprint } from './deviceFingerprint';

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(([key, itemValue]) => `${JSON.stringify(key)}:${stableSerialize(itemValue)}`)
    .join(',')}}`;
}

function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function buildSensitiveRequestHeaders(payload: unknown) {
  const token = await authStorage.getToken();
  if (!token) {
    throw new Error('Authentication is required');
  }

  const timestamp = Date.now().toString();
  const requestId = createRequestId();
  const deviceFingerprint = await getDeviceFingerprint();
  const serializedPayload = stableSerialize(payload);
  const signatureSeed = `${token}:${timestamp}:${requestId}:${serializedPayload}`;
  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    signatureSeed,
  );

  return {
    'X-Device-Fingerprint': deviceFingerprint,
    'X-Idempotency-Key': requestId,
    'X-Request-Id': requestId,
    'X-Request-Timestamp': timestamp,
    'X-Request-Signature': signature,
  };
}

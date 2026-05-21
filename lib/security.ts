const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const DISALLOWED_QUERY_CHARACTERS = /[^a-zA-Z0-9\s,?.\-]/g;

export const INDIAN_VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/;

export function normalizeVehicleNumber(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidIndianVehicleNumber(value: string) {
  return INDIAN_VEHICLE_NUMBER_REGEX.test(value.trim().toUpperCase());
}

export function sanitizeVoiceQuery(value: string) {
  return value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(DISALLOWED_QUERY_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function maskPayoutDestination(value?: string | null) {
  if (!value) {
    return 'your verified payout destination';
  }

  if (value.includes('@')) {
    const [localPart, domainPart] = value.split('@');
    const visibleLocal = localPart.slice(0, 2);
    return `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 2))}@${domainPart}`;
  }

  if (value.length >= 4) {
    return `••••${value.slice(-4)}`;
  }

  return value;
}

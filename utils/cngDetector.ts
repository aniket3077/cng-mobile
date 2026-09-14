const CNG_PROVIDER_PATTERNS = [
  /\bcng\b/i,
  /\bc\.n\.g\b/i,
  /\bmgl\b/i,
  /mahanagar gas/i,
  /\bigl\b/i,
  /indraprastha gas/i,
  /adani/i,
  /\batgl\b/i,
  /torrent gas/i,
  /gujarat gas/i,
  /\bmngl\b/i,
  /maharashtra natural gas/i,
  /\bgail\b/i,
  /\bcugl\b/i,
  /ag&p/i,
  /agp pratham/i,
  /think gas/i,
  /megha gas/i,
  /green gas/i,
  /sabarmati gas/i,
  /bhagyanagar gas/i,
  /aavantika gas/i,
  /haryana city gas/i,
  /sanwariya gas/i,
  /ioagpl/i,
  /godavari gas/i,
  /tripura natural gas/i,
  /natural gas/i,
  /gas company/i,
  /gas agency/i,
];

/**
 * Checks if a station name/address indicates that it offers CNG.
 * Rejects pure petrol/diesel pumps that do not mention CNG.
 */
export function isLikelyCngStation(name?: string, address?: string): boolean {
  if (!name) return false;
  const combined = `${name} ${address || ''}`;

  return CNG_PROVIDER_PATTERNS.some((pattern) => pattern.test(combined));
}

/**
 * Checks if fuelTypes string includes CNG
 */
export function hasCngFuel(fuelTypes?: string): boolean {
  if (!fuelTypes) return false;
  return fuelTypes.toUpperCase().includes('CNG');
}

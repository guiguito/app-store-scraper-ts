import type { RequestOptions } from '../http/client';

export function withCountryRequestOptions(
  requestOptions: RequestOptions | undefined,
  country?: string,
): RequestOptions | undefined {
  const normalizedCountry =
    typeof country === 'string' && country.trim().length > 0 ? country : undefined;
  if (!requestOptions && !normalizedCountry) return undefined;
  const merged: RequestOptions = { ...(requestOptions || {}) };
  if (normalizedCountry && typeof merged.country === 'undefined') merged.country = normalizedCountry;
  return merged;
}


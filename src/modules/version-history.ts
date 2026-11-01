import { catalogAppAttributes } from '../common';
import type { VersionHistoryItem } from '../types';

export interface VersionHistoryOptions {
  id: string | number;
  country?: string;
  requestOptions?: any;
}

export async function versionHistory(opts: VersionHistoryOptions): Promise<VersionHistoryItem[]> {
  if (!opts?.id) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('id is required');
  }
  const attributes = await catalogAppAttributes(
    opts.id,
    opts.country,
    'extend=versionHistory&additionalPlatforms=appletv,ipad,iphone,mac,realityDevice',
    opts.requestOptions,
  );
  // Mac-only apps report under `osx`, tvOS under `appletvos`, etc. Prefer iOS when present.
  const platforms: Record<string, { versionHistory?: VersionHistoryItem[] }> = attributes.platformAttributes ?? {};
  const platform = platforms.ios ?? Object.values(platforms).find((p) => Array.isArray(p?.versionHistory));
  return platform?.versionHistory ?? [];
}

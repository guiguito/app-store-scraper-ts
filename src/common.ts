import { defaultClient } from './http/client';
import type { RequestOptions } from './http/client';
import { markets } from './constants';
import { HttpError, NotFoundError } from './errors';
import type { App } from './types';
import { withCountryRequestOptions } from './utils/request-options';

const LOOKUP_URL = 'https://itunes.apple.com/lookup';

// Apple's RSS JSON feeds return a bare object instead of an array when there is a single entry.
export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function filterScreenshots(urls?: string[]): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter((url) => {
    const lowered = url.toLowerCase();
    if (lowered.includes('placeholder')) return false;
    if (/\/features\d*\//i.test(url)) return false;
    return true;
  });
}

export function cleanApp(app: any): App {
  return {
    id: app.trackId,
    appId: app.bundleId,
    title: app.trackName,
    url: app.trackViewUrl,
    description: app.description,
    icon: app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60,
    genres: app.genres,
    genreIds: app.genreIds,
    primaryGenre: app.primaryGenreName,
    primaryGenreId: app.primaryGenreId,
    contentRating: app.contentAdvisoryRating,
    languages: app.languageCodesISO2A,
    size: app.fileSizeBytes,
    requiredOsVersion: app.minimumOsVersion,
    released: app.releaseDate,
    updated: app.currentVersionReleaseDate || app.releaseDate,
    releaseNotes: app.releaseNotes,
    version: app.version,
    price: app.price,
    currency: app.currency,
    free: app.price === 0 || app.price === '0' || app.formattedPrice === 'Free',
    developerId: app.artistId,
    developer: app.artistName,
    developerUrl: app.artistViewUrl,
    developerWebsite: app.sellerUrl,
    score: app.averageUserRating,
    reviews: app.userRatingCount,
    currentVersionScore: app.averageUserRatingForCurrentVersion,
    currentVersionReviews: app.userRatingCountForCurrentVersion,
    screenshots: filterScreenshots(app.screenshotUrls),
    ipadScreenshots: filterScreenshots(app.ipadScreenshotUrls),
    appletvScreenshots: filterScreenshots(app.appletvScreenshotUrls),
    supportedDevices: app.supportedDevices,
  } as App;
}

export async function lookup(
  ids: Array<string | number>,
  idField: 'id' | 'bundleId' = 'id',
  country = 'us',
  lang?: string,
  requestOptions?: RequestOptions,
  subtitle = false,
): Promise<App[]> {
  const langParam = lang ? `&lang=${encodeURIComponent(lang)}` : '';
  const joinedIds = ids.join(',');
  const url = `${LOOKUP_URL}?${idField}=${joinedIds}&country=${country}&entity=software${langParam}`;
  const body = await defaultClient.request(
    url,
    {},
    withCountryRequestOptions(requestOptions, country),
  );
  const parsed = JSON.parse(body);
  const softwareOnly = (parsed.results || []).filter(
    (app: any) => typeof app.wrapperType === 'undefined' || app.wrapperType === 'software',
  );
  const apps: App[] = softwareOnly.map(cleanApp);
  if (subtitle) await addSubtitles(apps, country, requestOptions);
  return apps;
}

// For endpoints addressed by app id, where Apple answers 404 when the id is unknown.
export async function requestApp(
  url: string,
  headers: Record<string, string>,
  requestOptions?: RequestOptions,
): Promise<string> {
  try {
    return await defaultClient.request(url, headers, requestOptions);
  } catch (err) {
    if (err instanceof HttpError && err.statusCode === 404) throw new NotFoundError('App not found (404)');
    throw err;
  }
}

// Same JSON as amp-api.apps.apple.com, served by apps.apple.com's own proxy without a bearer token.
const CATALOG_URL = 'https://apps.apple.com/api/apps/v1/catalog';

// The catalog resource for one app: `attributes` plus `relationships` (e.g. top-in-apps).
export async function catalogApp(
  id: string | number,
  country: string | undefined,
  query: string,
  requestOptions?: RequestOptions,
): Promise<any> {
  const store = (country || 'us').toLowerCase();
  const url = `${CATALOG_URL}/${store}/apps/${encodeURIComponent(String(id))}?platform=web&${query}`;
  const body = await requestApp(url, {}, withCountryRequestOptions(requestOptions, store));
  const app = body ? JSON.parse(body)?.data?.[0] : undefined;
  if (!app?.attributes) throw new NotFoundError('App not found (404)');
  return app;
}

export async function catalogAppAttributes(
  id: string | number,
  country: string | undefined,
  query: string,
  requestOptions?: RequestOptions,
): Promise<any> {
  return (await catalogApp(id, country, query, requestOptions)).attributes;
}

// Apple rejects 100 ids with "Too Many Ids" although its error message says the limit is 100.
const CATALOG_MAX_IDS = 99;

/**
 * Sets `subtitle` on each app from Apple's catalog API: the lookup API has no subtitle field.
 * One request per 99 apps. Best effort: if a request fails, those apps keep no `subtitle`
 * instead of failing the whole call. The text is in the storefront's language (`country`).
 */
async function addSubtitles(apps: App[], country: string, requestOptions?: RequestOptions): Promise<void> {
  const store = country.toLowerCase();
  for (let i = 0; i < apps.length; i += CATALOG_MAX_IDS) {
    const chunk = apps.slice(i, i + CATALOG_MAX_IDS);
    const ids = chunk.map((a) => a.id).join(',');
    // additionalPlatforms makes Apple include platformAttributes; `platform=iphone` alone would drop Mac-only apps.
    const url = `${CATALOG_URL}/${store}/apps?ids=${ids}&platform=web&additionalPlatforms=iphone,mac`;
    try {
      const body = await defaultClient.request(url, {}, withCountryRequestOptions(requestOptions, store));
      const byId = new Map<string, any>(
        (JSON.parse(body)?.data ?? []).map((d: any) => [String(d.id), d.attributes?.platformAttributes]),
      );
      for (const app of chunk) {
        const platforms = byId.get(String(app.id));
        const text = platforms?.ios?.subtitle ?? platforms?.osx?.subtitle;
        if (text) app.subtitle = text;
      }
    } catch {
      // ponytail: silent best effort, like the screenshot fallback; surface errors if callers ask for it
    }
  }
}

export function storeId(countryCode?: string): string {
  const defaultStore = '143441';
  if (!countryCode) return defaultStore;
  const code = countryCode.toUpperCase() as keyof typeof markets;
  return String((markets as any)[code] ?? defaultStore);
}

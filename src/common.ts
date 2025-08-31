import { defaultClient } from './http/client';
import { markets } from './constants';
import type { App } from './types';

const LOOKUP_URL = 'https://itunes.apple.com/lookup';

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
    screenshots: app.screenshotUrls,
    ipadScreenshots: app.ipadScreenshotUrls,
    appletvScreenshots: app.appletvScreenshotUrls,
    supportedDevices: app.supportedDevices,
  } as App;
}

export async function lookup(
  ids: Array<string | number>,
  idField: 'id' | 'bundleId' = 'id',
  country = 'us',
  lang?: string,
  requestOptions?: any,
  limit?: number,
): Promise<App[]> {
  const langParam = lang ? `&lang=${encodeURIComponent(lang)}` : '';
  const joinedIds = ids.join(',');
  const url = `${LOOKUP_URL}?${idField}=${joinedIds}&country=${country}&entity=software${langParam}`;
  const body = await defaultClient.request(url, {}, requestOptions);
  const parsed = JSON.parse(body);
  const softwareOnly = (parsed.results || []).filter(
    (app: any) => typeof app.wrapperType === 'undefined' || app.wrapperType === 'software',
  );
  return softwareOnly.map(cleanApp);
}

export function storeId(countryCode?: string): string {
  const defaultStore = '143441';
  if (!countryCode) return defaultStore;
  const code = countryCode.toUpperCase() as keyof typeof markets;
  return String((markets as any)[code] ?? defaultStore);
}


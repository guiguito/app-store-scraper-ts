import { defaultClient } from '../http/client';
import type { RequestOptions } from '../http/client';
import type { App } from '../types';
import { withCountryRequestOptions } from './request-options';

type DeviceType = 'iphone' | 'ipad' | 'appletv';

export interface FallbackScreenshots {
  screenshots: string[];
  ipadScreenshots: string[];
  appletvScreenshots: string[];
}

const MZSTATIC_URL_REGEX = /https:\/\/[^"'\\\s]*\.mzstatic\.com[^"'\\\s]*/gi;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36';

export async function extractScreenshotsFromWeb(
  appId: string | number,
  country = 'us',
  requestOptions?: RequestOptions,
): Promise<FallbackScreenshots> {
  const url = `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`;
  try {
    const requestOpts = withCountryRequestOptions(requestOptions, country);
    const html = await defaultClient.request(
      url,
      {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.7',
      },
      requestOpts,
    );

    const matches = html.match(MZSTATIC_URL_REGEX) ?? [];
    if (matches.length === 0) {
      return emptyScreenshots();
    }

    const cleaned = matches
      .map(cleanScreenshotUrl)
      .filter((url): url is string => Boolean(url))
      .filter(isPotentialScreenshot);

    if (cleaned.length === 0) {
      return emptyScreenshots();
    }

    const grouped = classifyByDevice(cleaned);
    return {
      screenshots: finalizeDeviceGroup(grouped.iphone, 8),
      ipadScreenshots: finalizeDeviceGroup(grouped.ipad, 8),
      appletvScreenshots: finalizeDeviceGroup(grouped.appletv, 6),
    };
  } catch (err) {
    return emptyScreenshots();
  }
}

export async function getScreenshotsWithFallback(
  appData: App,
  appId: string | number,
  country = 'us',
  requestOptions?: RequestOptions,
): Promise<App> {
  const hasIphone = hasShots(appData.screenshots);
  const hasIpad = hasShots(appData.ipadScreenshots);
  const hasAppleTv = hasShots(appData.appletvScreenshots);

  if (hasIphone && hasIpad && hasAppleTv) return appData;

  const fallback = await extractScreenshotsFromWeb(appId, country, requestOptions);
  return {
    ...appData,
    screenshots: hasIphone ? appData.screenshots : fallback.screenshots,
    ipadScreenshots: hasIpad ? appData.ipadScreenshots : fallback.ipadScreenshots,
    appletvScreenshots: hasAppleTv ? appData.appletvScreenshots : fallback.appletvScreenshots,
  };
}

function emptyScreenshots(): FallbackScreenshots {
  return { screenshots: [], ipadScreenshots: [], appletvScreenshots: [] };
}

function hasShots(list?: string[] | null): boolean {
  return Array.isArray(list) && list.length > 0;
}

function cleanScreenshotUrl(url: string): string | undefined {
  let cleaned = url.replace(/\\/g, '');
  if (cleaned.includes('{w}x{h}{c}.{f}')) {
    cleaned = cleaned.replace('{w}x{h}{c}.{f}', '1242x2688bb.jpg');
    cleaned = cleaned.replace('{w}x{h}{c}.{f}\\', '1242x2688bb.jpg');
  }
  if (!cleaned.startsWith('http')) return undefined;
  return cleaned;
}

function isPotentialScreenshot(url: string): boolean {
  const lowered = url.toLowerCase();
  if (!/(\.png|\.jpg|\.jpeg)/i.test(url)) return false;
  if (lowered.includes('appicon') || lowered.includes('icon') || lowered.includes('logo')) return false;
  if (lowered.includes('artworkurl')) return false;
  return (
    lowered.includes('screenshot') ||
    lowered.includes('imagegen') ||
    lowered.includes('_of_') ||
    lowered.includes('slice_') ||
    /\d+x\d+/.test(url)
  );
}

function classifyByDevice(urls: string[]): Record<DeviceType, string[]> {
  const buckets: Record<DeviceType, string[]> = { iphone: [], ipad: [], appletv: [] };
  urls.forEach((url) => {
    const device = classifyDevice(url);
    buckets[device].push(url);
  });
  return buckets;
}

function classifyDevice(url: string): DeviceType {
  const lowered = url.toLowerCase();
  if (lowered.includes('appletv') || lowered.includes('1920x1080')) return 'appletv';
  if (
    lowered.includes('ipad') ||
    lowered.includes('slice_') ||
    lowered.includes('2048x2732') ||
    lowered.includes('2224x1668')
  ) {
    return 'ipad';
  }
  return 'iphone';
}

function finalizeDeviceGroup(urls: string[], limit: number): string[] {
  if (urls.length === 0) return [];
  const deduped = deduplicateScreenshots(urls);
  return deduped.slice(0, limit);
}

function deduplicateScreenshots(urls: string[]): string[] {
  const byBase = new Map<string, string>();
  urls.forEach((url) => {
    const key = extractBaseId(url);
    const current = byBase.get(key);
    if (!current) {
      byBase.set(key, url);
      return;
    }
    const winner = pickHigherResolution(current, url);
    byBase.set(key, winner);
  });
  return Array.from(byBase.values());
}

function extractBaseId(url: string): string {
  const match = url.match(/\/([a-f0-9-]{6,})\/([^/]+)\.[^/]+\/[^/]+$/i);
  if (match) return `${match[1]}/${match[2]}`;
  const parts = url.split('/');
  if (parts.length <= 2) return url;
  return parts.slice(0, parts.length - 1).join('/');
}

function pickHigherResolution(left: string, right: string): string {
  const leftScore = resolutionScore(left);
  const rightScore = resolutionScore(right);
  return rightScore > leftScore ? right : left;
}

function resolutionScore(url: string): number {
  const match = url.match(/(\d+)x(\d+)/);
  if (!match) return 0;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) ? width * height : 0;
}

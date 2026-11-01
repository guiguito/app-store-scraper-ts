import type { RequestOptions } from '../http/client';
import { catalogAppAttributes } from '../common';
import type { AppleJson } from '../common';
import type { App } from '../types';

type Shot = { url: string; width: number; height: number };
type ShotField = 'screenshots' | 'ipadScreenshots' | 'appletvScreenshots';

// Catalog screenshot types are keyed by device model (iphone_6_5, ipadPro_2018, appleTV, ...).
const FIELD_PREFIX: Record<ShotField, string> = {
  screenshots: 'iphone',
  ipadScreenshots: 'ipad',
  appletvScreenshots: 'appletv',
};

// Lookup sometimes returns no screenshots; the catalog API lists them grouped by device type.
export async function getScreenshotsWithFallback(
  appData: App,
  appId: string | number,
  country = 'us',
  requestOptions?: RequestOptions,
): Promise<App> {
  let attributes: AppleJson;
  try {
    attributes = await catalogAppAttributes(
      appId,
      country,
      'extend=screenshotsByType&additionalPlatforms=appletv,ipad,iphone,mac',
      requestOptions,
    );
  } catch {
    return appData; // screenshots are best effort; never fail app() over them
  }
  const byType: Record<string, Shot[]> = Object.assign(
    {},
    ...Object.values<AppleJson>(attributes.platformAttributes ?? {}).map((p) => p?.screenshotsByType ?? {}),
  );
  const result: App = { ...appData };
  for (const [field, prefix] of Object.entries(FIELD_PREFIX) as Array<[ShotField, string]>) {
    if (!result[field]?.length) result[field] = largest(byType, prefix);
  }
  return result;
}

// Several types exist per device (e.g. iphone_6_5 and iphone_d74); keep the highest-resolution set.
function largest(byType: Record<string, Shot[]>, prefix: string): string[] {
  const area = (shots: Shot[]) => shots[0].width * shots[0].height;
  const best = Object.entries(byType)
    .filter(([type, shots]) => type.toLowerCase().startsWith(prefix) && shots?.length)
    .map(([, shots]) => shots)
    .reduce<Shot[] | undefined>((a, b) => (!a || area(b) > area(a) ? b : a), undefined);
  return (best ?? []).map((s) => s.url.replace('{w}x{h}{c}.{f}', `${s.width}x${s.height}bb.jpg`));
}

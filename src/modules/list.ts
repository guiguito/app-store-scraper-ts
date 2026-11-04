import { ValidationError } from '../errors';
import { defaultClient } from '../http/client';
import type { RequestOptions } from '../http/client';
import type { App, AppLite } from '../types';
import { ensureArray, lookup, storeId } from '../common';
import type { AppleJson } from '../common';
import { category as CATEGORIES, collection as COLLECTIONS } from '../constants';
import { withCountryRequestOptions } from '../utils/request-options';

function parseLink(app: AppleJson): string | undefined {
  const link = app.link;
  if (!link) return undefined;
  const linkArray = Array.isArray(link) ? link : [link];
  const alternate = linkArray.find((l: AppleJson) => l.attributes?.rel === 'alternate');
  return alternate?.attributes?.href;
}

function cleanApp(app: AppleJson): AppLite {
  const price = parseFloat(app['im:price']?.attributes?.amount ?? '0');
  return {
    id: app.id?.attributes?.['im:id'],
    appId: app.id?.attributes?.['im:bundleId'],
    title: app['im:name']?.label,
    icon: app['im:image']?.[app['im:image'].length - 1]?.label,
    url: parseLink(app) as string, // feed entries always carry an alternate link
    price,
    currency: app['im:price']?.attributes?.currency,
    free: price === 0,
    description: app.summary ? app.summary.label : undefined,
    developer: app['im:artist']?.label,
    developerUrl: app['im:artist']?.attributes?.href,
    // Digits after /id: the feed's query string varies (?mt=8&uo=2, ?uo=2) and must not leak into the id.
    developerId: app['im:artist']?.attributes?.href?.match(/\/id(\d+)/)?.[1],
    genre: app.category?.attributes?.label,
    genreId: app.category?.attributes?.['im:id'],
    released: app['im:releaseDate']?.label,
  };
}

// From a lookup result, for chart ranks past the RSS feed. Ids are strings, like the RSS entries'.
function liteFromApp(app: App): AppLite {
  return {
    id: String(app.id),
    appId: app.appId,
    title: app.title,
    icon: app.icon,
    url: app.url,
    price: app.price,
    currency: app.currency,
    free: app.free,
    description: app.description,
    developer: app.developer,
    developerUrl: app.developerUrl,
    developerId: app.developerId === undefined ? undefined : String(app.developerId),
    genre: app.primaryGenre,
    genreId: app.primaryGenreId === undefined ? undefined : String(app.primaryGenreId),
    released: app.released,
  };
}

/**
 * The apps.apple.com chart that continues an RSS collection past its 100-entry cap, if any.
 * Checked in Nov 2026 to rank identically to RSS: iPhone top free (any category; none = genre 36,
 * "All Apps") and top paid with a category. RSS's overall paid chart mixes in games and the page's doesn't.
 */
function webChart(collection: string, category?: number): { genre: number; chart: string } | undefined {
  if (collection === COLLECTIONS.TOP_FREE_IOS) return { genre: category ?? 36, chart: 'top-free' };
  if (collection === COLLECTIONS.TOP_PAID_IOS && category) return { genre: category, chart: 'top-paid' };
  return undefined;
}

/**
 * Ranked app ids (up to 200) from the chart page's embedded server data. This is a web page, not an
 * API: any failure or unexpected shape returns [] and list() keeps the RSS result.
 */
async function webChartIds(country: string, genre: number, chart: string, requestOptions?: RequestOptions): Promise<string[]> {
  try {
    const html = await defaultClient.request(`https://apps.apple.com/${country}/iphone/charts/${genre}`, {}, requestOptions);
    const json = html.match(/<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/)?.[1];
    const segment = JSON.parse(json ?? '').data[0].data.segments.find((s: AppleJson) => s.chart === chart);
    // The top 25 come with details, the rest as bare ids. App bundles are ranked too but RSS leaves
    // them out: past rank 100 we drop them here; within RSS's range ranksAfterRss skips them anyway.
    const top = segment.shelves[0].items.map((i: AppleJson) => String(i.adamId));
    const rest = segment.nextPage.remainingContent
      .filter((r: AppleJson) => r.type === 'apps')
      .map((r: AppleJson) => String(r.id));
    return [...top, ...rest];
  } catch {
    return [];
  }
}

/**
 * The page's ranks after RSS's last entry, only if the page lists every RSS app in the same order.
 * The page may hold extra apps RSS drops (in paid charts, apps that just went free); those inside the
 * RSS range are skipped so ranks 1-100 stay exactly the RSS ones. Any other disagreement returns [].
 */
function ranksAfterRss(rssIds: string[], pageIds: string[]): string[] {
  let matched = 0;
  let last = -1;
  pageIds.forEach((id, i) => {
    if (id === rssIds[matched]) {
      matched++;
      last = i;
    }
  });
  return rssIds.length > 0 && matched === rssIds.length ? pageIds.slice(last + 1) : [];
}

export interface ListOptions {
  collection?: (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
  category?: (typeof CATEGORIES)[keyof typeof CATEGORIES];
  country?: string;
  lang?: string;
  /**
   * Apps to return (default 50, max 200). Apple's RSS feed stops at 100. Above 100, `TOP_FREE_IOS`
   * (any category or none) and `TOP_PAID_IOS` with a `category` also read the apps.apple.com chart page
   * for ranks 101-200; other collections, or a page that fails or disagrees with RSS, return 100.
   */
  num?: number;
  fullDetail?: boolean;
  /** Also fetch each app's App Store subtitle into `subtitle`: one extra request per 99 apps, skipped if it fails. Only with `fullDetail: true`. Default false. */
  subtitle?: boolean;
  requestOptions?: RequestOptions;
  throttle?: number;
}

export function list(opts: ListOptions & { fullDetail: true }): Promise<App[]>;
export function list(opts?: ListOptions & { fullDetail?: false }): Promise<AppLite[]>;
export function list(opts?: ListOptions): Promise<AppLite[] | App[]>;
export async function list(opts: ListOptions = {}): Promise<AppLite[] | App[]> {
  const collection = opts.collection ?? COLLECTIONS.TOP_FREE_IOS;
  if (!Object.values(COLLECTIONS).includes(collection)) throw new ValidationError(`Invalid collection ${opts.collection}`);
  if (opts.category && !Object.values(CATEGORIES).includes(opts.category)) throw new ValidationError(`Invalid category ${opts.category}`);
  const num = opts.num ?? 50;
  if (num > 200) throw new ValidationError('Cannot retrieve more than 200 apps');
  const country = opts.country ?? 'us';

  const categorySeg = opts.category ? `/genre=${opts.category}` : '';
  const s = storeId(country);
  const url = `http://ax.itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS/${collection}/${categorySeg}/limit=${num}/json?s=${s}`;
  const requestOptions = withCountryRequestOptions({ ...opts.requestOptions, throttle: opts.throttle }, country);
  const web = num > 100 ? webChart(collection, opts.category) : undefined;
  const [json, pageIds] = await Promise.all([
    defaultClient.request(url, {}, requestOptions),
    web ? webChartIds(country.toLowerCase(), web.genre, web.chart, requestOptions) : [],
  ]);
  const parsed = JSON.parse(json);
  const apps = ensureArray(parsed?.feed?.entry);
  const ids: string[] = apps.map((a: AppleJson) => a.id?.attributes?.['im:id']).filter(Boolean);
  const moreIds = ranksAfterRss(ids, pageIds).slice(0, num - ids.length);
  if (opts.fullDetail) {
    return lookup([...ids, ...moreIds], 'id', country, opts.lang, requestOptions, opts.subtitle);
  }
  const lite = apps.map(cleanApp);
  if (!moreIds.length) return lite;
  // ponytail: an id lookup doesn't return (app pulled since) is skipped, shifting later ranks by one
  const more = await lookup(moreIds, 'id', country, opts.lang, requestOptions).catch(() => []);
  opts.requestOptions?.signal?.throwIfAborted(); // the catch above must not swallow a cancel
  return [...lite, ...more.map(liteFromApp)];
}

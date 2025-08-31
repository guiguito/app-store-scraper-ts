import { lookup, storeId } from '../common';
import { category as CATEGORIES, collection as COLLECTIONS } from '../constants';

function parseLink(app: any): string | undefined {
  const link = app.link;
  if (!link) return undefined;
  const linkArray = Array.isArray(link) ? link : [link];
  const alternate = linkArray.find((l: any) => l.attributes?.rel === 'alternate');
  return alternate?.attributes?.href;
}

function cleanApp(app: any) {
  const price = parseFloat(app['im:price']?.attributes?.amount ?? '0');
  return {
    id: app.id?.attributes?.['im:id'],
    appId: app.id?.attributes?.['im:bundleId'],
    title: app['im:name']?.label,
    icon: app['im:image']?.[app['im:image'].length - 1]?.label,
    url: parseLink(app),
    price,
    currency: app['im:price']?.attributes?.currency,
    free: price === 0,
    description: app.summary ? app.summary.label : undefined,
    developer: app['im:artist']?.label,
    developerUrl: app['im:artist']?.attributes?.href,
    developerId: app['im:artist']?.attributes?.href?.includes('/id')
      ? app['im:artist']?.attributes?.href?.split('/id')[1]?.split('?mt')[0]
      : undefined,
    genre: app.category?.attributes?.label,
    genreId: app.category?.attributes?.['im:id'],
    released: app['im:releaseDate']?.label,
  };
}

export interface ListOptions {
  collection?: (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
  category?: (typeof CATEGORIES)[keyof typeof CATEGORIES];
  country?: string;
  lang?: string;
  num?: number;
  fullDetail?: boolean;
  requestOptions?: any;
  throttle?: number;
}

export async function list(opts: ListOptions = {}) {
  const collection = opts.collection ?? COLLECTIONS.TOP_FREE_IOS;
  if (!Object.values(COLLECTIONS).includes(collection)) throw new (await import('../errors')).ValidationError(`Invalid collection ${opts.collection}`);
  if (opts.category && !Object.values(CATEGORIES).includes(opts.category)) throw new (await import('../errors')).ValidationError(`Invalid category ${opts.category}`);
  const num = opts.num ?? 50;
  if (num > 200) throw new (await import('../errors')).ValidationError('Cannot retrieve more than 200 apps');
  const country = opts.country ?? 'us';

  const categorySeg = opts.category ? `/genre=${opts.category}` : '';
  const s = storeId(country);
  const url = `http://ax.itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS/${collection}/${categorySeg}/limit=${num}/json?s=${s}`;
  const { defaultClient } = await import('../http/client');
  const json = await defaultClient.request(url, {}, opts.requestOptions);
  const parsed = JSON.parse(json);
  const apps = parsed?.feed?.entry ?? [];
  if (opts.fullDetail) {
    const ids = apps.map((a: any) => a.id?.attributes?.['im:id']).filter(Boolean);
    return lookup(ids, 'id', country, opts.lang, opts.requestOptions, opts.throttle);
  }
  return apps.map(cleanApp);
}

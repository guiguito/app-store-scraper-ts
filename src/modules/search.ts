import { storeId, lookup } from '../common';

const BASE_URL = 'https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search?clientApplication=Software&media=software&term=';

function paginate<T>(arr: T[], num = 50, page = 1): T[] {
  const p = Math.max(1, page) - 1;
  const start = num * p;
  const end = start + num;
  return arr.slice(start, end);
}

export interface SearchOptions {
  term: string;
  num?: number;
  page?: number;
  country?: string;
  lang?: string;
  idsOnly?: boolean;
  requestOptions?: any;
  throttle?: number;
}

export async function search(opts: SearchOptions) {
  if (!opts?.term) throw new (await import('../errors')).ValidationError('term is required');
  const url = BASE_URL + encodeURIComponent(opts.term);
  const storeFront = storeId(opts.country);
  const lang = opts.lang || 'en-us';

  const { defaultClient } = await import('../http/client');
  const json = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeFront},24 t:native`, 'Accept-Language': lang },
    opts.requestOptions,
  );
  const parsed = JSON.parse(json);
  const results: Array<string | number> = (parsed?.bubbles?.[0]?.results ?? []).map((r: any) => r.id);
  const windowed: Array<string | number> = paginate(results, opts.num || 50, opts.page || 1);
  if (opts.idsOnly) return windowed;
  return lookup(windowed, 'id', opts.country, opts.lang, opts.requestOptions, opts.throttle);
}

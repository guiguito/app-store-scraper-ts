import { ValidationError } from '../errors';
import { defaultClient } from '../http/client';
import type { RequestOptions } from '../http/client';
import { storeId, lookup } from '../common';
import type { App } from '../types';
import { withCountryRequestOptions } from '../utils/request-options';

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
  /** Also fetch each app's App Store subtitle into `subtitle`: one extra request per 99 apps, skipped if it fails. Default false. */
  subtitle?: boolean;
  requestOptions?: RequestOptions;
  throttle?: number;
}

export function search(opts: SearchOptions & { idsOnly: true }): Promise<Array<string | number>>;
export function search(opts: SearchOptions & { idsOnly?: false }): Promise<App[]>;
export function search(opts: SearchOptions): Promise<App[] | Array<string | number>>;
export async function search(opts: SearchOptions): Promise<App[] | Array<string | number>> {
  if (!opts?.term) throw new ValidationError('term is required');
  const url = BASE_URL + encodeURIComponent(opts.term);
  const country = opts.country || 'us';
  const storeFront = storeId(country);
  const lang = opts.lang || 'en-us';

  const requestOptions = withCountryRequestOptions({ ...opts.requestOptions, throttle: opts.throttle }, country);
  const json = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeFront},24 t:native`, 'Accept-Language': lang },
    requestOptions,
  );
  const parsed = JSON.parse(json);
  const results: Array<string | number> = (parsed?.bubbles?.[0]?.results ?? []).map((r: any) => r.id);
  const windowed: Array<string | number> = paginate(results, opts.num || 50, opts.page || 1);
  if (opts.idsOnly) return windowed;
  return lookup(windowed, 'id', country, opts.lang, requestOptions, opts.subtitle);
}

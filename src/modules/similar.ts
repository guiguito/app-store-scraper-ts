import { NotFoundError, ValidationError } from '../errors';
import { storeId, lookup } from '../common';
import { defaultClient } from '../http/client';
import type { RequestOptions } from '../http/client';
import type { App } from '../types';
import { withCountryRequestOptions } from '../utils/request-options';

export interface SimilarOptions {
  id?: string | number;
  appId?: string;
  country?: string;
  lang?: string;
  /** Also fetch each app's App Store subtitle into `subtitle`: one extra request per 99 apps, skipped if it fails. Default false. */
  subtitle?: boolean;
  requestOptions?: RequestOptions;
  throttle?: number;
}

const BASE_URL = 'https://itunes.apple.com/us/app/app/id';

export async function similar(opts: SimilarOptions): Promise<App[]> {
  if (!opts?.id && !opts?.appId) {
    throw new ValidationError('Either id or appId is required');
  }
  const country = opts.country || 'us';
  const requestOptions = withCountryRequestOptions({ ...opts.requestOptions, throttle: opts.throttle }, country);
  let id = opts.id;
  if (!id) {
    const [found] = await lookup([opts.appId!], 'bundleId', country, opts.lang, requestOptions);
    if (!found) throw new NotFoundError('App not found (404)');
    id = found.id;
  }
  const url = `${BASE_URL}${id}`;
  const txt = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeId(country)},32` },
    requestOptions,
  );
  const index = txt.indexOf('customersAlsoBoughtApps');
  if (index === -1) return [];
  const regExp = /customersAlsoBoughtApps\":(.*?\])/g;
  const match = regExp.exec(txt);
  const ids = match ? JSON.parse(match[1]) : [];
  if (!ids || ids.length === 0) return [];
  return lookup(ids, 'id', country, opts.lang, requestOptions, opts.subtitle);
}

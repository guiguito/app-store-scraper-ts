import { app as appMethod } from './app';
import { storeId, lookup } from '../common';
import { defaultClient } from '../http/client';

export interface SimilarOptions {
  id?: string | number;
  appId?: string;
  country?: string;
  lang?: string;
  requestOptions?: any;
  throttle?: number;
}

const BASE_URL = 'https://itunes.apple.com/us/app/app/id';

export async function similar(opts: SimilarOptions) {
  if (!opts?.id && !opts?.appId) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Either id or appId is required');
  }
  const id = opts.id || (await appMethod(opts).then((a) => a.id));
  const url = `${BASE_URL}${id}`;
  const txt = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeId(opts.country)},32` },
    opts.requestOptions,
  );
  const index = txt.indexOf('customersAlsoBoughtApps');
  if (index === -1) return [];
  const regExp = /customersAlsoBoughtApps\":(.*?\])/g;
  const match = regExp.exec(txt);
  const ids = match ? JSON.parse(match[1]) : [];
  if (!ids || ids.length === 0) return [];
  return lookup(ids, 'id', opts.country, opts.lang, opts.requestOptions, opts.throttle);
}

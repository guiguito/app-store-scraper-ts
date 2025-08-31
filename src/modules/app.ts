import { lookup } from '../common';
import type { App } from '../types';
import { ratings as ratingsMethod } from './ratings';

export interface AppOptions {
  id?: string | number;
  appId?: string;
  country?: string;
  lang?: string;
  requestOptions?: any;
  throttle?: number;
  ratings?: boolean;
}

export async function app(opts: AppOptions): Promise<App> {
  if (!opts?.id && !opts?.appId) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Either id or appId is required');
  }
  const idField = opts.id ? 'id' : 'bundleId';
  const idValue = (opts.id ?? opts.appId!) as string | number;
  const results = await lookup([idValue], idField as any, opts.country, opts.lang, opts.requestOptions, opts.throttle);
  if (results.length === 0) {
    const { NotFoundError } = await import('../errors');
    throw new NotFoundError('App not found (404)');
  }

  const result = results[0];
  if (opts.ratings) {
    if (!opts.id) opts.id = result.id;
    const ratings = await ratingsMethod({ id: String(opts.id), country: opts.country, requestOptions: opts.requestOptions });
    return { ...result, ...ratings } as App;
  }
  return result;
}

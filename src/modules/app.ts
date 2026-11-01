import { NotFoundError, ValidationError } from '../errors';
import type { RequestOptions } from '../http/client';
import { lookup } from '../common';
import type { App } from '../types';
import { getScreenshotsWithFallback } from '../utils/screenshotFallback';
import { withCountryRequestOptions } from '../utils/request-options';
import { ratings as ratingsMethod } from './ratings';
import { inAppPurchases as inAppPurchasesMethod } from './in-app-purchases';

export interface AppOptions {
  id?: string | number;
  appId?: string;
  country?: string;
  lang?: string;
  requestOptions?: RequestOptions;
  throttle?: number;
  ratings?: boolean;
  /** Also fetch each app's App Store subtitle into `subtitle`: one extra request per 99 apps, skipped if it fails. Default false. */
  subtitle?: boolean;
  /** Also fetch the app's top in-app purchases into `inAppPurchases`: one extra request; throws if it fails. Default false. */
  inAppPurchases?: boolean;
}

export async function app(opts: AppOptions): Promise<App> {
  if (!opts?.id && !opts?.appId) {
    throw new ValidationError('Either id or appId is required');
  }
  const idField = opts.id ? 'id' : 'bundleId';
  const idValue = (opts.id ?? opts.appId!) as string | number;
  const requestOptions = withCountryRequestOptions(
    { ...opts.requestOptions, throttle: opts.throttle },
    opts.country,
  );
  const results = await lookup([idValue], idField as any, opts.country, opts.lang, requestOptions, opts.subtitle);
  if (results.length === 0) {
    throw new NotFoundError('App not found (404)');
  }

  let result = results[0];

  // Only scrape when lookup returned no screenshots at all. Empty iPad screenshots alone
  // usually mean an iPhone-only (or Mac) app, and scraping those doubles every app() call.
  if (!Array.isArray(result.screenshots) || result.screenshots.length === 0) {
    result = await getScreenshotsWithFallback(
      result,
      result.id ?? idValue,
      opts.country,
      requestOptions,
    );
  }
  if (opts.inAppPurchases) {
    const purchases = await inAppPurchasesMethod({ id: result.id, country: opts.country, requestOptions });
    result = { ...result, inAppPurchases: purchases };
  }
  if (opts.ratings) {
    const ratings = await ratingsMethod({
      id: String(opts.id ?? result.id),
      country: opts.country,
      requestOptions,
    });
    return { ...result, ...ratings } as App;
  }
  return result;
}

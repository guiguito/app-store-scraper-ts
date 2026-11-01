import * as constants from './constants';
import { app } from './modules/app';
import { ratings } from './modules/ratings';
import { list } from './modules/list';
import { search } from './modules/search';
import { developer } from './modules/developer';
import { suggest } from './modules/suggest';
import { similar } from './modules/similar';
import { reviews } from './modules/reviews';
import { privacy } from './modules/privacy';
import { versionHistory } from './modules/version-history';

export { constants, app, ratings, list, search, developer, suggest, similar, reviews, privacy, versionHistory };
export {
  configureDefaultProxy,
  configureCountryProxies,
  getCountryProxyMap,
  getDefaultProxyConfig,
  setProxyUsageListener,
} from './http/client';
export type { ProxyOptions, ProxyUsageEvent, RequestOptions } from './http/client';
export { HttpError, NotFoundError, ValidationError } from './errors';
export type { AppOptions } from './modules/app';
export type { RatingsOptions } from './modules/ratings';
export type { ListOptions } from './modules/list';
export type { SearchOptions } from './modules/search';
export type { DeveloperOptions } from './modules/developer';
export type { SuggestOptions } from './modules/suggest';
export type { SimilarOptions } from './modules/similar';
export type { ReviewsOptions } from './modules/reviews';
export type { PrivacyOptions } from './modules/privacy';
export type { VersionHistoryOptions } from './modules/version-history';
export * from './types';

type AnyFn = (...args: any[]) => any;

function memoize<T extends AnyFn>(fn: T, opts: { maxAge?: number; max?: number } = {}): T {
  const maxAge = opts.maxAge ?? 1000 * 60 * 5; // 5 minutes
  const max = opts.max ?? 1000;
  const cache = new Map<string, { v: any; t: number }>();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now - entry.t < maxAge) return entry.v;
    const result = fn(...args);
    if (cache.size >= max) {
      const first = cache.keys().next().value as string | undefined;
      if (typeof first !== 'undefined') cache.delete(first);
    }
    cache.set(key, { v: result, t: now });
    // Drop failures so a transient 429/5xx isn't replayed for maxAge.
    result?.catch?.(() => {
      if (cache.get(key)?.v === result) cache.delete(key);
    });
    return result;
  }) as T;
}

export function memoized(opts?: { maxAge?: number; max?: number }) {
  return {
    ...constants, // kept for existing `store.collection` users
    constants, // same shape as the main export
    app: memoize(app, opts),
    ratings: memoize(ratings, opts),
    list: memoize(list, opts),
    search: memoize(search, opts),
    developer: memoize(developer, opts),
    suggest: memoize(suggest, opts),
    similar: memoize(similar, opts),
    reviews: memoize(reviews, opts),
    privacy: memoize(privacy, opts),
    versionHistory: memoize(versionHistory, opts),
  };
}

export * as constants from './constants';
export { app } from './modules/app';
export { ratings } from './modules/ratings';
export { list } from './modules/list';
export { search } from './modules/search';
export { developer } from './modules/developer';
export { suggest } from './modules/suggest';
export { similar } from './modules/similar';
export { reviews } from './modules/reviews';
export { privacy } from './modules/privacy';
export { versionHistory } from './modules/version-history';

// TODO: implement and export these modules
export * from './types';

type AnyFn = (...args: any[]) => any;

function memoize<T extends AnyFn>(fn: T, opts: { maxAge?: number; max?: number } = {}) {
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
    return result;
  }) as T;
}

export function memoized(opts?: { maxAge?: number; max?: number }) {
  return {
    ...require('./constants'),
    app: memoize(require('./modules/app').app, opts),
    ratings: memoize(require('./modules/ratings').ratings, opts),
    list: memoize(require('./modules/list').list, opts),
    search: memoize(require('./modules/search').search, opts),
    developer: memoize(require('./modules/developer').developer, opts),
    suggest: memoize(require('./modules/suggest').suggest, opts),
    similar: memoize(require('./modules/similar').similar, opts),
    reviews: memoize(require('./modules/reviews').reviews, opts),
    privacy: memoize(require('./modules/privacy').privacy, opts),
    versionHistory: memoize(require('./modules/version-history').versionHistory, opts),
  };
}

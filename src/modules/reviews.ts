import { ensureArray, lookup } from '../common';
import { sort as SORT } from '../constants';
import { withCountryRequestOptions } from '../utils/request-options';

export interface ReviewsOptions {
  id?: string | number;
  appId?: string; // bundle id, resolved to the numeric id via lookup
  sort?: typeof SORT[keyof typeof SORT];
  page?: number;
  country?: string;
  requestOptions?: any;
}

export async function reviews(opts: ReviewsOptions) {
  if (!opts?.id && !opts?.appId) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Either id or appId is required');
  }
  if (opts.sort && !Object.values(SORT).includes(opts.sort)) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Invalid sort ' + opts.sort);
  }
  if (opts.page && opts.page < 1) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Page cannot be lower than 1');
  }
  if (opts.page && opts.page > 10) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Page cannot be greater than 10');
  }

  const page = opts.page || 1;
  const sort = opts.sort || SORT.RECENT;
  const country = opts.country || 'us';
  const requestOptions = withCountryRequestOptions(opts.requestOptions, country);
  let id = opts.id;
  if (!id) {
    const [found] = await lookup([opts.appId!], 'bundleId', country, undefined, requestOptions);
    if (!found) {
      const { NotFoundError } = await import('../errors');
      throw new NotFoundError('App not found (404)');
    }
    id = found.id;
  }
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=${sort}/json`;
  const { defaultClient } = await import('../http/client');
  const json = await defaultClient.request(url, {}, requestOptions);
  const parsed = JSON.parse(json);
  const list = ensureArray(parsed?.feed?.entry);
  return list.map((review: any) => ({
    id: review.id?.label,
    userName: review.author?.name?.label,
    userUrl: review.author?.uri?.label,
    version: review['im:version']?.label,
    score: parseInt(review['im:rating']?.label, 10),
    title: review.title?.label,
    text: review.content?.label,
    url: review.link?.attributes?.href,
    updated: review.updated?.label,
  }));
}

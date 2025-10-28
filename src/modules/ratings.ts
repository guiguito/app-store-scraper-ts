import { defaultClient } from '../http/client';
import { storeId } from '../common';
import * as cheerio from 'cheerio';
import { withCountryRequestOptions } from '../utils/request-options';

export interface RatingsOptions {
  id: string | number;
  country?: string;
  requestOptions?: any;
}

export async function ratings(opts: RatingsOptions): Promise<{ ratings: number; histogram: Record<string, number> }> {
  if (!opts?.id) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('id is required');
  }
  const country = opts.country || 'us';
  const storefront = storeId(country);
  const idValue = String(opts.id);
  const url = `https://itunes.apple.com/${country}/customer-reviews/id${idValue}?displayable-kind=11`;
  const requestOptions = withCountryRequestOptions(opts.requestOptions, country);
  const html = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storefront},12` },
    requestOptions,
  );
  if (!html || html.length === 0) {
    const { NotFoundError } = await import('../errors');
    throw new NotFoundError('App not found (404)');
  }

  const $ = cheerio.load(html);
  const ratingsMatch = $('.rating-count').text().match(/\d+/);
  const total = Array.isArray(ratingsMatch) ? parseInt(ratingsMatch[0], 10) : 0;
  const ratingsByStar = $('.vote .total')
    .map((i, el) => parseInt($(el).text(), 10))
    .get();
  const histogram = ratingsByStar.reduce<Record<string, number>>((acc, n, idx) => {
    acc[String(5 - idx)] = n;
    return acc;
  }, {});
  return { ratings: total, histogram };
}

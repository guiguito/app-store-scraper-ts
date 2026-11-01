import { NotFoundError, ValidationError } from '../errors';
import type { RequestOptions } from '../http/client';
import { requestApp, storeId } from '../common';
import type { Ratings } from '../types';
import * as cheerio from 'cheerio';
import { withCountryRequestOptions } from '../utils/request-options';

export interface RatingsOptions {
  id: string | number;
  country?: string;
  requestOptions?: RequestOptions;
}

export async function ratings(opts: RatingsOptions): Promise<Ratings> {
  if (!opts?.id) {
    throw new ValidationError('id is required');
  }
  const country = opts.country || 'us';
  const storefront = storeId(country);
  const idValue = String(opts.id);
  const url = `https://itunes.apple.com/${country}/customer-reviews/id${idValue}?displayable-kind=11`;
  const requestOptions = withCountryRequestOptions(opts.requestOptions, country);
  const html = await requestApp(
    url,
    { 'X-Apple-Store-Front': `${storefront},12` },
    requestOptions,
  );
  if (!html || html.length === 0) {
    throw new NotFoundError('App not found (404)');
  }

  const $ = cheerio.load(html);
  // "4,037,246 Ratings" / "429 205 notes" / "271.603 Bewertungen": drop the locale's thousands separators.
  const total = parseInt($('.rating-count').text().replace(/\D/g, ''), 10) || 0;
  const ratingsByStar = $('.vote .total')
    .map((i, el) => parseInt($(el).text(), 10))
    .get();
  const histogram = ratingsByStar.reduce<Record<string, number>>((acc, n, idx) => {
    acc[String(5 - idx)] = n;
    return acc;
  }, {});
  return { ratings: total, histogram };
}

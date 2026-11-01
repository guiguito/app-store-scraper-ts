import { ValidationError } from '../errors';
import { defaultClient } from '../http/client';
import type { RequestOptions } from '../http/client';
import { storeId } from '../common';
import { parseXml } from '../utils/xml';
import { withCountryRequestOptions } from '../utils/request-options';

const BASE_URL = 'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=';

export interface SuggestOptions {
  term: string;
  country?: string;
  requestOptions?: RequestOptions;
}

export async function suggest(opts: SuggestOptions): Promise<Array<{ term: string }>> {
  if (!opts || !opts.term) throw new ValidationError('term missing');
  const url = BASE_URL + encodeURIComponent(opts.term);
  const country = opts.country || 'us';
  const xml = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeId(country)},29` },
    withCountryRequestOptions(opts.requestOptions, country),
  );
  const parsed: any = parseXml(xml);
  // Path: plist -> dict[0] -> array[0] -> dict[] -> each dict has "string" entries, first being term
  const list = parsed?.plist?.dict?.array?.dict || parsed?.plist?.dict?.[0]?.array?.[0]?.dict || [];
  const items = Array.isArray(list) ? list : [list];
  return items
    .map((d: any) => {
      const str = d?.string || d?.string?.[0];
      const term = Array.isArray(str) ? str[0] : str;
      return term ? { term } : undefined;
    })
    .filter((item): item is { term: string } => Boolean(item));
}

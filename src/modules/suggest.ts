import { storeId } from '../common';
import { parseXml } from '../utils/xml';
import { withCountryRequestOptions } from '../utils/request-options';

const BASE_URL = 'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=';

export interface SuggestOptions {
  term: string;
  country?: string;
  requestOptions?: any;
}

export async function suggest(opts: SuggestOptions) {
  if (!opts || !opts.term) throw new (await import('../errors')).ValidationError('term missing');
  const url = BASE_URL + encodeURIComponent(opts.term);
  const { defaultClient } = await import('../http/client');
  const xml = await defaultClient.request(
    url,
    { 'X-Apple-Store-Front': `${storeId(opts.country)},29` },
    withCountryRequestOptions(opts.requestOptions, opts.country),
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
    .filter(Boolean);
}

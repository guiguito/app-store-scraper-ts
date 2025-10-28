import { lookup } from '../common';
import { withCountryRequestOptions } from '../utils/request-options';

export interface DeveloperOptions {
  devId: string | number;
  country?: string;
  lang?: string;
  requestOptions?: any;
  throttle?: number;
}

export async function developer(opts: DeveloperOptions) {
  if (!opts?.devId) throw new (await import('../errors')).ValidationError('devId is required');
  const requestOptions = withCountryRequestOptions(opts.requestOptions, opts.country);
  const res = await lookup(
    [opts.devId],
    'id',
    opts.country,
    opts.lang,
    requestOptions,
    opts.throttle,
  );
  if (res.length === 0) throw new Error('Developer not found (404)');
  return res;
}

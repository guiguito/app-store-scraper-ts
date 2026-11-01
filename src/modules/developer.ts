import { NotFoundError, ValidationError } from '../errors';
import type { RequestOptions } from '../http/client';
import { lookup } from '../common';
import type { App } from '../types';
import { withCountryRequestOptions } from '../utils/request-options';

export interface DeveloperOptions {
  devId: string | number;
  country?: string;
  lang?: string;
  /** Also fetch each app's App Store subtitle into `subtitle`: one extra request per 99 apps, skipped if it fails. Default false. */
  subtitle?: boolean;
  requestOptions?: RequestOptions;
  throttle?: number;
}

export async function developer(opts: DeveloperOptions): Promise<App[]> {
  if (!opts?.devId) throw new ValidationError('devId is required');
  const requestOptions = withCountryRequestOptions({ ...opts.requestOptions, throttle: opts.throttle }, opts.country);
  const res = await lookup(
    [opts.devId],
    'id',
    opts.country,
    opts.lang,
    requestOptions,
    opts.subtitle,
  );
  if (res.length === 0) throw new NotFoundError('Developer not found (404)');
  return res;
}

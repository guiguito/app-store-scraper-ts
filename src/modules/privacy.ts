import { ValidationError } from '../errors';
import type { RequestOptions } from '../http/client';
import { catalogAppAttributes } from '../common';
import type { PrivacyDetails } from '../types';

export interface PrivacyOptions {
  id: string | number;
  country?: string;
  requestOptions?: RequestOptions;
}

export async function privacy(opts: PrivacyOptions): Promise<PrivacyDetails> {
  if (!opts?.id) {
    throw new ValidationError('id is required');
  }
  const attributes = await catalogAppAttributes(opts.id, opts.country, 'fields=privacyDetails', opts.requestOptions);
  return attributes.privacyDetails;
}

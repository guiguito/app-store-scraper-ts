import { catalogAppAttributes } from '../common';

export interface PrivacyOptions {
  id: string | number;
  country?: string;
  requestOptions?: any;
}

export async function privacy(opts: PrivacyOptions) {
  if (!opts?.id) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('id is required');
  }
  const attributes = await catalogAppAttributes(opts.id, opts.country, 'fields=privacyDetails', opts.requestOptions);
  return attributes.privacyDetails;
}

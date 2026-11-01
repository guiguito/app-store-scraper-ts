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
  // The policy link lives under platformAttributes, which Apple only returns with additionalPlatforms.
  const attributes = await catalogAppAttributes(
    opts.id,
    opts.country,
    'fields=privacyDetails,privacyPolicyUrl&additionalPlatforms=iphone,mac',
    opts.requestOptions,
  );
  const platforms = attributes.platformAttributes ?? {};
  return {
    ...attributes.privacyDetails,
    privacyPolicyUrl: platforms.ios?.privacyPolicyUrl ?? platforms.osx?.privacyPolicyUrl ?? null,
  };
}

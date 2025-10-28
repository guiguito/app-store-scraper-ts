import { defaultClient } from '../http/client';
import { withCountryRequestOptions } from '../utils/request-options';

export interface PrivacyOptions {
  id: string | number;
  country?: string;
  requestOptions?: any;
}

export async function privacy(opts: PrivacyOptions) {
  const country = opts.country || 'US';
  if (!opts?.id) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Either id or appId is required');
  }

  const tokenUrl = `https://apps.apple.com/${country}/app/id${opts.id}`;
  const html = await defaultClient.request(
    tokenUrl,
    {},
    withCountryRequestOptions(opts.requestOptions, country),
  );
  const regExp = /token%22%3A%22([^%]+)%22%7D/g;
  const match = regExp.exec(html);
  const token = match && match[1];

  const url = `https://amp-api-edge.apps.apple.com/v1/catalog/${country}/apps/${opts.id}?platform=web&fields=privacyDetails`;
  const json = await defaultClient.request(
    url,
    { Origin: 'https://apps.apple.com', Authorization: `Bearer ${token}` },
    withCountryRequestOptions(opts.requestOptions, country),
  );
  if (!json || json.length === 0) {
    const { NotFoundError } = await import('../errors');
    throw new NotFoundError('App not found (404)');
  }
  return JSON.parse(json).data[0].attributes.privacyDetails;
}

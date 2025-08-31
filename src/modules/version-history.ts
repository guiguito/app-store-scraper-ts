import { defaultClient } from '../http/client';

export interface VersionHistoryOptions {
  id: string | number;
  country?: string;
  requestOptions?: any;
}

export async function versionHistory(opts: VersionHistoryOptions) {
  const country = opts.country || 'US';
  if (!opts?.id) {
    const { ValidationError } = await import('../errors');
    throw new ValidationError('Either id or appId is required');
  }

  const tokenUrl = `https://apps.apple.com/${country}/app/id${opts.id}`;
  const html = await defaultClient.request(tokenUrl, {}, opts.requestOptions);
  const regExp = /token%22%3A%22([^%]+)%22%7D/g;
  const match = regExp.exec(html);
  const token = match && match[1];

  const url = `https://amp-api-edge.apps.apple.com/v1/catalog/${country}/apps/${opts.id}?platform=web&extend=versionHistory&additionalPlatforms=appletv,ipad,iphone,mac,realityDevice`;
  const json = await defaultClient.request(url, { Origin: 'https://apps.apple.com', Authorization: `Bearer ${token}` }, opts.requestOptions);
  if (!json || json.length === 0) {
    const { NotFoundError } = await import('../errors');
    throw new NotFoundError('App not found (404)');
  }
  return JSON.parse(json).data[0].attributes.platformAttributes.ios.versionHistory;
}

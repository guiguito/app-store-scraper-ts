import { ValidationError } from '../errors';
import type { RequestOptions } from '../http/client';
import { catalogApp } from '../common';
import type { InAppPurchase } from '../types';

export interface InAppPurchasesOptions {
  id: string | number;
  country?: string;
  requestOptions?: RequestOptions;
}

function cleanInAppPurchase(iap: any): InAppPurchase {
  const a = iap.attributes ?? {};
  const offer = a.offers?.[0] ?? {};
  return {
    id: iap.id,
    productId: a.offerName,
    title: a.name,
    description: a.description?.standard,
    price: offer.price,
    currency: offer.currencyCode,
    formattedPrice: offer.priceFormatted,
    subscription: Boolean(a.isSubscription),
    subscriptionPeriod: offer.recurringSubscriptionPeriod,
  };
}

/**
 * The app's top in-app purchases (up to 10, as listed on the App Store page), priced in the
 * `country` storefront. One request to Apple's catalog API; an empty array when the app has none.
 */
export async function inAppPurchases(opts: InAppPurchasesOptions): Promise<InAppPurchase[]> {
  if (!opts?.id) {
    throw new ValidationError('id is required');
  }
  // Apple only allows this relationship on single-app requests, so it can't be batched.
  const app = await catalogApp(opts.id, opts.country, 'include=top-in-apps', opts.requestOptions);
  return (app.relationships?.['top-in-apps']?.data ?? []).map(cleanInAppPurchase);
}

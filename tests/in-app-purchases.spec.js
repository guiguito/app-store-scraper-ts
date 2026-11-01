const { expect } = require('chai');
const store = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

// Trimmed from Apple's catalog response for Duolingo (?include=top-in-apps).
const CONSUMABLE = {
  id: '1444292180',
  attributes: {
    name: 'XS Gold Bars Pack', description: { standard: 'XS Gold Bars Pack' }, isSubscription: false,
    offerName: 'com.example.goldpack1',
    offers: [{ currencyCode: 'EUR', price: 1.99, priceFormatted: '1,99 €', type: 'buy' }],
  },
};
const SUBSCRIPTION = {
  id: '1365793322',
  attributes: {
    name: 'Super Duolingo', description: { standard: 'Go ad-free and offline any lesson.' }, isSubscription: true,
    offerName: 'com.duolingo.DuolingoMobile.subscription.Premium.OneMonth',
    offers: [{ currencyCode: 'EUR', price: 9.99, priceFormatted: '9,99 €', recurringSubscriptionPeriod: 'P1M', type: 'buy' }],
  },
};

function catalog(iaps) {
  return JSON.stringify({ data: [{ id: '570060128', attributes: { name: 'Duolingo' }, relationships: { 'top-in-apps': { data: iaps } } }] });
}

describe('inAppPurchases', () => {
  afterEach(() => resetFetch());

  it('maps consumables and subscriptions from one catalog request in the right storefront', async () => {
    const urls = [];
    __setFetchForTests(mockFetch((url) => { urls.push(url); return { body: catalog([CONSUMABLE, SUBSCRIPTION]) }; }));
    const iaps = await store.inAppPurchases({ id: 570060128, country: 'FR' });
    expect(urls).to.deep.equal(['https://apps.apple.com/api/apps/v1/catalog/fr/apps/570060128?platform=web&include=top-in-apps']);
    expect(iaps).to.deep.equal([
      { id: '1444292180', productId: 'com.example.goldpack1', title: 'XS Gold Bars Pack', description: 'XS Gold Bars Pack', price: 1.99, currency: 'EUR', formattedPrice: '1,99 €', subscription: false, subscriptionPeriod: undefined },
      { id: '1365793322', productId: 'com.duolingo.DuolingoMobile.subscription.Premium.OneMonth', title: 'Super Duolingo', description: 'Go ad-free and offline any lesson.', price: 9.99, currency: 'EUR', formattedPrice: '9,99 €', subscription: true, subscriptionPeriod: 'P1M' },
    ]);
  });

  it('returns an empty array for apps without in-app purchases', async () => {
    __setFetchForTests(mockFetch(() => ({ body: catalog([]) })));
    expect(await store.inAppPurchases({ id: 361309726 })).to.deep.equal([]);
  });

  it('app({ inAppPurchases: true }) attaches them; off by default', async () => {
    const urls = [];
    __setFetchForTests(mockFetch((url) => {
      urls.push(url);
      if (url.startsWith('https://itunes.apple.com/lookup')) return { body: JSON.stringify({ results: [{ trackId: 570060128, trackName: 'Duolingo', screenshotUrls: ['s'] }] }) };
      return { body: catalog([SUBSCRIPTION]) };
    }));
    expect(await store.app({ id: 570060128 })).to.not.have.property('inAppPurchases');
    expect(urls).to.have.length(1);
    const app = await store.app({ id: 570060128, inAppPurchases: true });
    expect(app.inAppPurchases.map((i) => i.title)).to.deep.equal(['Super Duolingo']);
  });
});

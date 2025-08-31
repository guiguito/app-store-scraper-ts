const { expect } = require('chai');
const store = require('../../dist/cjs');
const { __setFetchForTests } = require('../../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('../helpers');

function makeBubbles(ids) {
  return JSON.stringify({ bubbles: [{ results: ids.map((id) => ({ id })) }] });
}

function makeLookup(ids, country = 'us') {
  return JSON.stringify({
    results: ids.map((id) => ({
      trackId: id,
      bundleId: `app.${id}`,
      trackName: `App ${id}`,
      trackViewUrl: `https://apps.apple.com/${country}/app/${id}?uo=4`,
      description: 'd',
      price: 0,
      currency: 'USD',
      artistId: 1,
      artistName: 'Dev',
      averageUserRating: 4.5,
      userRatingCount: 100,
      screenshotUrls: ['https://img/s1.png'],
    }) ),
  });
}

describe('Contract: search (parity with reference)', () => {
  afterEach(() => resetFetch());

  it('returns country-specific URLs and passes country to lookup', async () => {
    const ids = ['100', '101'];
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          const qs = new URL(url).searchParams;
          const country = qs.get('country');
          expect(country).to.equal('fr');
          const list = (qs.get('id') || '').split(',').filter(Boolean);
          return { body: makeLookup(list, 'fr') };
        }
        return { status: 404, body: '' };
      }),
    );

    const apps = await store.search({ country: 'fr', term: 'Panda', num: 2 });
    expect(apps).to.have.length(2);
    apps.forEach((a) => expect(a.url).to.match(/^https:\/\/apps\.apple\.com\/fr/));
  });

  it('propagates requestOptions (HTTP error surfaces status code)', async () => {
    __setFetchForTests(
      mockFetch((url, init) => {
        // Any request with DELETE returns a 501 to simulate server behavior
        if (init?.method === 'DELETE') return { status: 501, body: '' };
        if (url.includes('/wa/search?')) return { body: makeBubbles(['1']) };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: makeLookup(['1']) };
        return { status: 404, body: '' };
      }),
    );

    try {
      await store.search({ term: 'vr', requestOptions: { method: 'DELETE' } });
      throw new Error('should not resolve');
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response.statusCode).to.equal(501);
    }
  });
});


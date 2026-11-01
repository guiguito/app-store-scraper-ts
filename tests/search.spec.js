const { expect } = require('chai');
const { search } = require('../dist/cjs');
const { __setFetchForTests, setProxyUsageListener } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

function makeBubbles(ids) {
  return JSON.stringify({ bubbles: [ { results: ids.map((id) => ({ id })) } ] });
}

function makeLookup(ids) {
  return JSON.stringify({ results: ids.map((id) => ({ trackId: id, bundleId: `app.${id}`, trackName: `App ${id}`, trackViewUrl: `https://apps.apple.com/app/${id}`, description: 'd', price: 0, currency: 'USD', artistId: 1, artistName: 'Dev' })) });
}

describe('M2: search', () => {
  afterEach(() => resetFetch());

  it('returns application list', async () => {
    const ids = ['1', '2'];
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: makeLookup(ids) };
        return { status: 404, body: '' };
      }),
    );
    const apps = await search({ term: 'Panda', num: 2 });
    expect(apps).to.have.length(2);
    expect(apps[0].title).to.equal('App 1');
  });

  it('paginates properly', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          const qs = new URL(url).searchParams;
          const list = (qs.get('id') || '').split(',').filter(Boolean);
          return { body: makeLookup(list) };
        }
        return { status: 404, body: '' };
      }),
    );
    const p1 = await search({ term: 'Panda', num: 10, page: 1 });
    const p2 = await search({ term: 'Panda', num: 10, page: 2 });
    expect(p1).to.have.length(10);
    expect(p2).to.have.length(10);
    expect(p1[0].appId).to.not.equal(p2[0].appId);
  });

  it('idsOnly returns array of ids', async () => {
    const ids = ['10', '11', '12'];
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        return { status: 404, body: '' };
      }),
    );
    const res = await search({ term: 'vr', idsOnly: true, num: 3 });
    expect(res).to.deep.equal(ids);
  });
});


describe('search: proxy country', () => {
  afterEach(() => { resetFetch(); setProxyUsageListener(); });

  it('tags every request with the US storefront when no country is given', async () => {
    const countries = [];
    setProxyUsageListener((e) => countries.push(e.country));
    __setFetchForTests(mockFetch((url) => (url.includes('/wa/search?') ? { body: makeBubbles(['1']) } : { body: makeLookup(['1']) })));
    await search({ term: 'x' });
    expect(countries).to.deep.equal(['US', 'US']);
  });
});

describe('search: throttle', () => {
  afterEach(() => resetFetch());

  it('spaces requests according to `throttle` (requests per second)', async () => {
    const starts = [];
    __setFetchForTests(mockFetch((url) => {
      starts.push(Date.now());
      if (url.includes('MZStore.woa/wa/search')) return { body: JSON.stringify({ bubbles: [ { results: [ { id: '1' } ] } ] }) };
      return { body: JSON.stringify({ results: [ { trackId: 1, bundleId: 'a', trackName: 'A' } ] }) };
    }));
    const res = await search({ term: 'x', throttle: 1 });
    expect(res).to.have.length(1);
    expect(starts).to.have.length(2);
    expect(starts[1] - starts[0]).to.be.at.least(900); // throttle 1 = starts spaced 1000ms apart
  });
});

// Moved from the former contract tests: the only checks there not covered elsewhere.
describe('search: options reach every request', () => {
  afterEach(() => resetFetch());

  it('passes country to the lookup', async () => {
    const countries = [];
    __setFetchForTests(mockFetch((url) => {
      if (url.includes('/wa/search?')) return { body: makeBubbles(['100']) };
      countries.push(new URL(url).searchParams.get('country'));
      return { body: makeLookup(['100']) };
    }));
    await search({ country: 'fr', term: 'Panda' });
    expect(countries).to.deep.equal(['fr']);
  });

  it('forwards requestOptions to the HTTP layer', async () => {
    __setFetchForTests(mockFetch((_url, init) => (init.method === 'DELETE' ? { status: 501 } : { body: makeBubbles(['1']) })));
    await search({ term: 'vr', requestOptions: { method: 'DELETE' } }).then(() => { throw new Error('should fail'); }, (e) => expect(e.statusCode).to.equal(501));
  });
});

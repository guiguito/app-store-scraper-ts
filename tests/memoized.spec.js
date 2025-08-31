const { expect } = require('chai');
const { memoized } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

describe('M4: memoized facade', () => {
  afterEach(() => resetFetch());

  it('caches results for identical args', async () => {
    let lookups = 0;
    const lookupBody = JSON.stringify({ results: [ { trackId: 1, bundleId: 'app.one', trackName: 'One', trackViewUrl: 'https://apps.apple.com/app/1', description: 'd', price: 0, currency: 'USD', artistId: 9, artistName: 'Dev' } ] });
    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          lookups += 1;
          return { body: lookupBody };
        }
        return { status: 404, body: '' };
      }),
    );
    const store = memoized();
    const p1 = store.app({ id: '1' });
    const p2 = store.app({ id: '1' });
    expect(p1).to.equal(p2); // same memoized promise
    await p1;
    await p2;
    expect(lookups).to.equal(1);
  });
});


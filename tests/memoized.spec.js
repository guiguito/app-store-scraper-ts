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


describe('memoized: failures are not cached', () => {
  afterEach(() => resetFetch());

  it('retries a call that previously failed instead of replaying the rejection', async () => {
    let fail = true;
    let lookups = 0;
    const lookupBody = JSON.stringify({ results: [ { trackId: 1, bundleId: 'app.one', trackName: 'One', screenshotUrls: ['s'], ipadScreenshotUrls: ['i'], appletvScreenshotUrls: ['t'] } ] });
    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          lookups += 1;
          return fail ? { status: 404, body: '' } : { body: lookupBody };
        }
        return { status: 404, body: '' };
      }),
    );
    const store = memoized();
    await store.app({ id: '1' }).then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('HttpError'));
    fail = false;
    const app = await store.app({ id: '1' });
    expect(app.id).to.equal(1);
    expect(lookups).to.equal(2);
  });
});

describe('memoized: expiry and eviction', () => {
  afterEach(() => resetFetch());

  function countingLookup() {
    const counter = { lookups: 0 };
    __setFetchForTests(mockFetch((url) => {
      counter.lookups += 1;
      const id = new URL(url).searchParams.get('id');
      return { body: JSON.stringify({ results: [ { trackId: Number(id), trackName: id, screenshotUrls: ['s'] } ] }) };
    }));
    return counter;
  }

  it('refetches once maxAge has passed', async () => {
    const counter = countingLookup();
    const store = memoized({ maxAge: 30 });
    await store.app({ id: '1' });
    await store.app({ id: '1' });
    expect(counter.lookups).to.equal(1);
    await new Promise((r) => setTimeout(r, 40));
    await store.app({ id: '1' });
    expect(counter.lookups).to.equal(2);
  });

  it('evicts the oldest entry beyond max', async () => {
    const counter = countingLookup();
    const store = memoized({ max: 2 });
    await store.app({ id: '1' });
    await store.app({ id: '2' });
    await store.app({ id: '3' }); // evicts id 1
    await store.app({ id: '2' }); // still cached
    expect(counter.lookups).to.equal(3);
    await store.app({ id: '1' });
    expect(counter.lookups).to.equal(4);
  });
});

describe('memoized: API shape', () => {
  it('exposes `constants` like the main export (and keeps top-level constants)', () => {
    const { constants } = require('../dist/cjs');
    const store = memoized();
    expect(store.constants.collection.TOP_FREE_IOS).to.equal(constants.collection.TOP_FREE_IOS);
    expect(store.collection.TOP_FREE_IOS).to.equal(constants.collection.TOP_FREE_IOS);
  });
});

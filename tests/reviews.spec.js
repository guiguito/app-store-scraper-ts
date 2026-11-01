const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { reviews } = require('../dist/cjs/modules/reviews');

describe('M3: reviews (tests first)', () => {
  afterEach(() => resetFetch());

  it('retrieves reviews list', async () => {
    const json = JSON.stringify({
      feed: {
        entry: [
          {
            id: { label: 'r1' },
            author: { name: { label: 'Alice' }, uri: { label: 'https://itunes.apple.com/us/reviews/id1' } },
            'im:version': { label: '1.0.0' },
            'im:rating': { label: '5' },
            title: { label: 'Great' },
            content: { label: 'Nice app' },
            link: { attributes: { href: 'https://itunes.apple.com/us/review?id=1&type=Purple%20Software' } },
            updated: { label: '2024-01-01T00:00:00-07:00' }
          }
        ]
      }
    });

    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/rss/customerreviews/')) return { body: json };
        return { status: 404, body: '' };
      }),
    );
    const res = await reviews({ id: '553834731' });
    expect(res[0].userName).to.equal('Alice');
    expect(res[0].score).to.equal(5);
  });

  it('validates page upper bound', async () => {
    try {
      await reviews({ id: '553834731', page: 11 });
      throw new Error('should not reach');
    } catch (e) {
      expect(e.message).to.equal('Page cannot be greater than 10');
    }
  });
});


describe('reviews: appId resolution', () => {
  afterEach(() => resetFetch());

  it('resolves appId (bundle id) to the numeric id before fetching reviews', async () => {
    const urls = [];
    __setFetchForTests(
      mockFetch((url) => {
        urls.push(url);
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: JSON.stringify({ results: [ { trackId: 553834731, bundleId: 'com.midasplayer.apps.candycrushsaga' } ] }) };
        if (url.includes('customerreviews')) return { body: JSON.stringify({ feed: {} }) };
        return { status: 404, body: '' };
      }),
    );
    await reviews({ appId: 'com.midasplayer.apps.candycrushsaga' });
    expect(urls[0]).to.include('bundleId=com.midasplayer.apps.candycrushsaga');
    expect(urls[1]).to.include('/id=553834731/');
  });

  it('throws NotFoundError when the appId does not exist', async () => {
    __setFetchForTests(mockFetch(() => ({ body: JSON.stringify({ results: [] }) })));
    await reviews({ appId: 'com.does.not.exist' }).then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('NotFoundError'));
  });
});

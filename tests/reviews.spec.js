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


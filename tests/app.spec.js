const { expect } = require('chai');
const { app, ratings, constants } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

describe('M1: app + ratings', () => {
  afterEach(() => resetFetch());

  it('app: fetches details by id and merges ratings when requested', async () => {
    const lookupBody = JSON.stringify({
      results: [
        {
          trackId: 553834731,
          bundleId: 'com.midasplayer.apps.candycrushsaga',
          trackName: 'Candy Crush Saga',
          trackViewUrl: 'https://apps.apple.com/us/app/candy-crush-saga/id553834731?uo=4',
          description: 'desc',
          artworkUrl512: 'https://img/icon.png',
          genres: ['Games'],
          genreIds: ['6014'],
          primaryGenreName: 'Games',
          primaryGenreId: 6014,
          contentAdvisoryRating: '4+',
          languageCodesISO2A: ['EN'],
          fileSizeBytes: '123',
          minimumOsVersion: '13.0',
          releaseDate: '2020-01-01T00:00:00Z',
          currentVersionReleaseDate: '2024-01-01T00:00:00Z',
          releaseNotes: 'notes',
          version: '1.0.0',
          price: 0,
          currency: 'USD',
          artistId: 526656015,
          artistName: 'King',
          artistViewUrl: 'https://apps.apple.com/us/developer/king/id526656015?uo=4',
          sellerUrl: 'https://king.com',
          averageUserRating: 4.5,
          userRatingCount: 100,
          averageUserRatingForCurrentVersion: 4.7,
          userRatingCountForCurrentVersion: 10,
          screenshotUrls: ['https://img/s1.png'],
          ipadScreenshotUrls: [],
          appletvScreenshotUrls: [],
          supportedDevices: ['iPhone']
        }
      ]
    });
    const ratingsHtml = `
      <div class="rating-count">1234 Ratings</div>
      <div class="vote"><span class="total">10</span></div>
      <div class="vote"><span class="total">20</span></div>
      <div class="vote"><span class="total">30</span></div>
      <div class="vote"><span class="total">40</span></div>
      <div class="vote"><span class="total">50</span></div>
    `;

    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          return { body: lookupBody };
        }
        if (url.includes('/customer-reviews/')) {
          return { body: ratingsHtml };
        }
        return { status: 404, body: '' };
      }),
    );

    const result = await app({ id: '553834731', ratings: true });
    expect(result.title).to.equal('Candy Crush Saga');
    expect(result.appId).to.equal('com.midasplayer.apps.candycrushsaga');
    expect(result.url).to.match(/^https:\/\/apps\.apple\.com\/us/);
    expect(result.ratings).to.equal(1234);
    expect(result.histogram).to.deep.equal({ '5': 10, '4': 20, '3': 30, '2': 40, '1': 50 });
  });

  it('app: throws for missing app', async () => {
    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          return { body: JSON.stringify({ results: [] }) };
        }
        return { status: 404, body: '' };
      }),
    );

    try {
      await app({ id: '123' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err.message).to.equal('App not found (404)');
    }
  });

  it('app: falls back to catalog screenshots when lookup returns none', async () => {
    const lookupBody = JSON.stringify({
      results: [
        {
          trackId: 553834731,
          bundleId: 'com.openai.chat',
          trackName: 'ChatGPT',
          trackViewUrl: 'https://apps.apple.com/us/app/chatgpt/id6448311069',
          description: 'desc',
          artworkUrl512: 'https://example/icon.png',
          screenshotUrls: [],
          ipadScreenshotUrls: [],
          appletvScreenshotUrls: [],
          price: 0,
          currency: 'USD',
          artistId: 123,
          artistName: 'OpenAI',
        },
      ],
    });

    // Shape of the catalog's screenshotsByType (real keys); iPhone has two types, the larger one wins.
    const shot = (name, width, height) => ({ url: `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/aa/${name}.png/{w}x{h}{c}.{f}`, width, height });
    const catalog = JSON.stringify({ data: [ { attributes: { platformAttributes: {
      ios: { screenshotsByType: { iphone_6_5: [shot('p1', 1242, 2688)], iphone_d74: [shot('p2', 1290, 2796)], ipadPro_2018: [shot('t1', 2048, 2732)], cassatt: [shot('x', 1, 1)] } },
      appletvos: { screenshotsByType: { appleTV: [shot('tv1', 1920, 1080)] } },
    } } } ] });

    const urls = [];
    __setFetchForTests(
      mockFetch((url) => {
        urls.push(url);
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        if (url.startsWith('https://apps.apple.com/api/apps/v1/catalog/')) return { body: catalog };
        return { status: 404, body: '' };
      }),
    );

    const result = await app({ id: '553834731' });
    expect(urls[1]).to.include('extend=screenshotsByType');
    expect(result.screenshots).to.deep.equal(['https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/aa/p2.png/1290x2796bb.jpg']);
    expect(result.ipadScreenshots).to.deep.equal(['https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/aa/t1.png/2048x2732bb.jpg']);
    expect(result.appletvScreenshots).to.have.length(1);
  });

  it('app: keeps lookup data when the screenshot fallback fails', async () => {
    const lookupBody = JSON.stringify({ results: [ { trackId: 1, trackName: 'One', screenshotUrls: [] } ] });
    __setFetchForTests(mockFetch((url) => (url.startsWith('https://itunes.apple.com/lookup') ? { body: lookupBody } : { status: 403, body: '' })));
    const result = await app({ id: '1' });
    expect(result.title).to.equal('One');
    expect(result.screenshots).to.deep.equal([]);
  });

  it('ratings: parses totals and histogram', async () => {
    const html = `
      <div class="rating-count">42 Ratings</div>
      <div class="vote"><span class="total">1</span></div>
      <div class="vote"><span class="total">2</span></div>
      <div class="vote"><span class="total">3</span></div>
      <div class="vote"><span class="total">4</span></div>
      <div class="vote"><span class="total">5</span></div>
    `;
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/customer-reviews/')) return { body: html };
        return { status: 404, body: '' };
      }),
    );
    const res = await ratings({ id: '1' });
    expect(res.ratings).to.equal(42);
    expect(res.histogram).to.deep.equal({ '5': 1, '4': 2, '3': 3, '2': 4, '1': 5 });
  });
});

describe('app: side effects and extra requests', () => {
  afterEach(() => resetFetch());

  const lookupBody = JSON.stringify({ results: [ { trackId: 553834731, bundleId: 'com.king.candy', trackName: 'Candy', screenshotUrls: ['https://img/s1.png'], ipadScreenshotUrls: [] } ] });

  it('does not fetch fallback screenshots when only iPad screenshots are missing (iPhone-only app)', async () => {
    const urls = [];
    __setFetchForTests(mockFetch((url) => { urls.push(url); return url.startsWith('https://itunes.apple.com/lookup') ? { body: lookupBody } : { status: 404, body: '' }; }));
    const result = await app({ id: '553834731' });
    expect(result.screenshots).to.deep.equal(['https://img/s1.png']);
    expect(urls).to.have.length(1);
  });

  it('does not mutate the caller options when resolving ratings by appId', async () => {
    __setFetchForTests(mockFetch((url) => {
      if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
      if (url.includes('/customer-reviews/id553834731')) return { body: '<div class="rating-count">7 Ratings</div>' };
      return { status: 404, body: '' };
    }));
    const opts = { appId: 'com.king.candy', ratings: true };
    const result = await app(opts);
    expect(result.ratings).to.equal(7);
    expect(opts).to.deep.equal({ appId: 'com.king.candy', ratings: true });
  });
});

describe('ratings: totals with thousands separators', () => {
  afterEach(() => resetFetch());

  // Real formats from the us, fr (U+202F narrow no-break space) and de storefronts.
  for (const [label, text, expected] of [
    ['us', '4,037,246 Ratings', 4037246],
    ['fr', '429 205 notes', 429205],
    ['de', '271.603 Bewertungen', 271603],
  ]) {
    it(`parses "${label}" format`, async () => {
      __setFetchForTests(mockFetch(() => ({ body: `<div class="rating-count">${text}</div>` })));
      const res = await ratings({ id: '1' });
      expect(res.ratings).to.equal(expected);
    });
  }
});

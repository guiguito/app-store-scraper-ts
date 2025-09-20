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

  it('app: falls back to web screenshots when API returns none', async () => {
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

    const fallbackHtml = `
      <html><body>
      https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/aa/bb/cc/iphone-1/1242x2688bb.jpg
      https://is2-ssl.mzstatic.com/image/thumb/Purple126/v4/dd/ee/ff/ipad-1/2048x2732bb.jpg
      </body></html>
    `;

    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        if (url.startsWith('https://apps.apple.com')) return { body: fallbackHtml };
        return { status: 404, body: '' };
      }),
    );

    const result = await app({ id: '553834731' });
    expect(result.screenshots).to.have.length(1);
    expect(result.screenshots[0]).to.include('1242x2688');
    expect(result.ipadScreenshots).to.have.length(1);
    expect(result.ipadScreenshots[0]).to.include('2048x2732');
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

const { expect } = require('chai');
const store = require('../../dist/cjs');
const { __setFetchForTests } = require('../../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('../helpers');

// Contract tests mirroring upstream expectations for `app` without ratings merge

describe('Contract: app (parity with reference)', () => {
  afterEach(() => resetFetch());

  it('matches reference shape for core fields (no ratings)', async () => {
    const lookupBody = JSON.stringify({
      resultCount: 1,
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
          supportedDevices: ['iPhone'],
        },
      ],
    });

    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }),
    );

    const app = await store.app({ id: '553834731' });
    expect(app.appId).to.equal('com.midasplayer.apps.candycrushsaga');
    expect(app.title).to.equal('Candy Crush Saga');
    expect(app.url).to.equal('https://apps.apple.com/us/app/candy-crush-saga/id553834731?uo=4');
    expect(app.icon).to.match(/^https:\/\/img\//);

    expect(app.score).to.be.a('number');
    expect(app.score).to.be.gte(0).and.lte(5);

    expect(app).to.not.have.property('ratings');
    expect(app).to.not.have.property('histogram');

    expect(app.reviews).to.be.a('number');
    expect(app.description).to.be.a('string');
    expect(app.updated).to.be.a('string');
    expect(app.primaryGenre).to.equal('Games');
    expect(app.primaryGenreId).to.equal(6014);
    expect(app.genres).to.be.an('array').with.length.greaterThan(0);
    expect(app.genreIds).to.be.an('array').with.length.greaterThan(0);
    expect(app.version).to.be.a('string');
    expect(app.contentRating).to.equal('4+');
    expect(app.requiredOsVersion).to.equal('13.0');
    expect(app.free).to.equal(true);
    expect(app.developer).to.equal('King');
    expect(app.screenshots).to.be.an('array').with.length.greaterThan(0);
    expect(app.releaseNotes).to.be.a('string');
  });
});


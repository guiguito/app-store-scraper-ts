const { expect } = require('chai');
const store = require('../../dist/cjs');
const { __setFetchForTests } = require('../../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('../helpers');

// Contract test mirroring upstream expectations for `developer`

describe('Contract: developer (parity with reference)', () => {
  afterEach(() => resetFetch());

  it('returns apps with consistent developer metadata', async () => {
    const devId = '284882218';
    const lookupBody = JSON.stringify({
      resultCount: 3,
      results: [
        // The iTunes lookup with entity=software usually includes an artist entry; our impl filters non-software
        { wrapperType: 'artist', artistType: 'Artist', artistId: Number(devId), artistName: 'Meta Platforms, Inc.' },
        {
          trackId: 1,
          bundleId: 'com.meta.app1',
          trackName: 'Meta App 1',
          trackViewUrl: 'https://apps.apple.com/us/app/meta-app-1/id1?uo=4',
          description: 'desc',
          artworkUrl512: 'https://img/icon1.png',
          genres: ['Social Networking'],
          genreIds: ['6005'],
          primaryGenreName: 'Social Networking',
          primaryGenreId: 6005,
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
          artistId: Number(devId),
          artistName: 'Meta Platforms, Inc.',
          artistViewUrl: `https://apps.apple.com/us/developer/meta/id${devId}?uo=4`,
          sellerUrl: 'https://meta.com',
          averageUserRating: 4.1,
          userRatingCount: 10,
          averageUserRatingForCurrentVersion: 4.0,
          userRatingCountForCurrentVersion: 1,
          screenshotUrls: ['https://img/s1.png'],
          ipadScreenshotUrls: [],
          appletvScreenshotUrls: [],
          supportedDevices: ['iPhone'],
        },
        {
          trackId: 2,
          bundleId: 'com.meta.app2',
          trackName: 'Meta App 2',
          trackViewUrl: 'https://apps.apple.com/us/app/meta-app-2/id2?uo=4',
          description: 'desc',
          artworkUrl512: 'https://img/icon2.png',
          genres: ['Social Networking'],
          genreIds: ['6005'],
          primaryGenreName: 'Social Networking',
          primaryGenreId: 6005,
          contentAdvisoryRating: '4+',
          languageCodesISO2A: ['EN'],
          fileSizeBytes: '456',
          minimumOsVersion: '13.0',
          releaseDate: '2021-01-01T00:00:00Z',
          currentVersionReleaseDate: '2024-05-01T00:00:00Z',
          releaseNotes: 'notes2',
          version: '2.0.0',
          price: 0,
          currency: 'USD',
          artistId: Number(devId),
          artistName: 'Meta Platforms, Inc.',
          artistViewUrl: `https://apps.apple.com/us/developer/meta/id${devId}?uo=4`,
          sellerUrl: 'https://meta.com',
          averageUserRating: 4.3,
          userRatingCount: 20,
          averageUserRatingForCurrentVersion: 4.2,
          userRatingCountForCurrentVersion: 2,
          screenshotUrls: ['https://img/s2.png'],
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

    const apps = await store.developer({ devId });
    expect(apps).to.be.an('array').with.length(2);
    for (const app of apps) {
      expect(app.developerId).to.equal(Number(devId));
      expect(app.developer).to.equal('Meta Platforms, Inc.');
      expect(app.appId).to.be.a('string');
      expect(app.title).to.be.a('string');
      expect(app.description).to.be.a('string');
      expect(app.url).to.be.a('string');
      expect(app.icon).to.be.a('string');
      expect(app.free).to.be.a('boolean');
    }
  });
});


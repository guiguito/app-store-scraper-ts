const { expect } = require('chai');
const { developer } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

describe('M2: developer', () => {
  afterEach(() => resetFetch());

  it('returns developer apps', async () => {
    const devId = '284882218';
    const lookupBody = JSON.stringify({ results: [
      { trackId: '1', bundleId: 'app.one', trackName: 'One', trackViewUrl: 'https://apps.apple.com/app/1', description: 'd', price: 0, currency: 'USD', artistId: devId, artistName: 'Meta Platforms, Inc.' },
      { trackId: '2', bundleId: 'app.two', trackName: 'Two', trackViewUrl: 'https://apps.apple.com/app/2', description: 'd', price: 0, currency: 'USD', artistId: devId, artistName: 'Meta Platforms, Inc.' }
    ]});
    __setFetchForTests(
      mockFetch((url) => {
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }),
    );
    const apps = await developer({ devId });
    expect(apps.length).to.equal(2);
    apps.forEach((a) => {
      expect(String(a.developerId)).to.equal(devId);
      expect(a.developer).to.equal('Meta Platforms, Inc.');
    });
  });
});


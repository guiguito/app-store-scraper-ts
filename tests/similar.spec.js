const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { similar } = require('../dist/cjs/modules/similar');

const lookupBody = JSON.stringify({ results: [
  { trackId: '1', bundleId: 'app.1', trackName: 'One', trackViewUrl: 'https://apps.apple.com/app/1', description: 'd', price: 0, currency: 'USD', artistId: 'd1', artistName: 'Dev1' },
  { trackId: '2', bundleId: 'app.2', trackName: 'Two', trackViewUrl: 'https://apps.apple.com/app/2', description: 'd', price: 0, currency: 'USD', artistId: 'd2', artistName: 'Dev2' },
] });

describe('M3: similar', () => {
  afterEach(() => resetFetch());

  it('returns similar apps via lookup ids', async () => {
    const html = '... customersAlsoBoughtApps": ["1","2","3"]';
    const urls = [];
    __setFetchForTests(
      mockFetch((url) => {
        urls.push(url);
        if (url.includes('itunes.apple.com') && url.includes('/app/id')) return { body: html };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }),
    );
    const res = await similar({ id: '553834731' });
    expect(res.map((a) => a.appId)).to.deep.equal(['app.1', 'app.2']);
    expect(urls[1]).to.include('id=1,2,3');
  });

  it('resolves appId to an id first', async () => {
    const urls = [];
    __setFetchForTests(
      mockFetch((url) => {
        urls.push(url);
        if (url.includes('bundleId=com.king.candy')) return { body: JSON.stringify({ results: [ { trackId: 553834731, bundleId: 'com.king.candy', screenshotUrls: ['s'] } ] }) };
        if (url.includes('/app/id553834731')) return { body: 'customersAlsoBoughtApps":["1","2"]' };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }),
    );
    const res = await similar({ appId: 'com.king.candy' });
    expect(res).to.have.length(2);
  });

  it('returns [] when the page has no similar apps', async () => {
    __setFetchForTests(mockFetch(() => ({ body: '<html>nothing here</html>' })));
    expect(await similar({ id: '1' })).to.deep.equal([]);
  });

  it('requires id or appId', async () => {
    await similar({}).then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('ValidationError'));
  });
});

const { expect } = require('chai');
const { list, constants } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

describe('M2: list', () => {
  afterEach(() => resetFetch());

  it('validates category', async () => {
    try {
      await list({ category: 'wrong', collection: constants.collection.TOP_FREE_IOS });
      throw new Error('should not reach');
    } catch (e) {
      expect(e.message).to.equal('Invalid category wrong');
    }
  });

  it('validates collection', async () => {
    try {
      await list({ category: constants.category.GAMES_ACTION, collection: 'wrong' });
      throw new Error('should not reach');
    } catch (e) {
      expect(e.message).to.equal('Invalid collection wrong');
    }
  });

  it('validates num limit', async () => {
    try {
      await list({ category: constants.category.GAMES_ACTION, collection: constants.collection.TOP_FREE_IOS, num: 250 });
      throw new Error('should not reach');
    } catch (e) {
      expect(e.message).to.equal('Cannot retrieve more than 200 apps');
    }
  });

  it('fetches list (summary items)', async () => {
    const rss = JSON.stringify({ feed: { entry: [ { id: { attributes: { 'im:id': '1', 'im:bundleId': 'app.one' } }, 'im:name': { label: 'App One' }, 'im:image': [{ label: 'a' }, { label: 'b' }], link: [{ attributes: { rel: 'alternate', href: 'https://apps.apple.com/app/1' } }], 'im:price': { attributes: { amount: '0', currency: 'USD' } }, summary: { label: 'summary' }, 'im:artist': { label: 'Dev', attributes: { href: 'https://itunes.apple.com/us/artist/dev/id9?mt=8&uo=2' } }, category: { attributes: { label: 'Games', 'im:id': '6014' } }, 'im:releaseDate': { label: '2020-01-01' } } ] } });
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/ws/RSS/')) return { body: rss };
        return { status: 404, body: '' };
      }),
    );
    const apps = await list({ collection: constants.collection.TOP_FREE_IOS, num: 1 });
    expect(apps).to.have.length(1);
    expect(apps[0].title).to.equal('App One');
    expect(apps[0].free).to.equal(true);
  });

  it('fetches list with fullDetail via lookup', async () => {
    const rss = JSON.stringify({ feed: { entry: [ { id: { attributes: { 'im:id': '1', 'im:bundleId': 'app.one' } }, 'im:name': { label: 'App One' }, 'im:image': [{label:'a'}] } ] } });
    const lookupBody = JSON.stringify({ results: [ { trackId: 1, bundleId: 'app.one', trackName: 'App One', trackViewUrl: 'https://apps.apple.com/app/1', description: 'desc', price: 0, currency: 'USD', artistId: 9, artistName: 'Dev' } ] });

    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/ws/RSS/')) return { body: rss };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }),
    );
    const apps = await list({ collection: constants.collection.TOP_FREE_IOS, fullDetail: true, num: 1 });
    expect(apps).to.have.length(1);
    expect(apps[0].appId).to.equal('app.one');
    expect(apps[0].description).to.equal('desc');
  });
});


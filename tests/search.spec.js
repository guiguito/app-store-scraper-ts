const { expect } = require('chai');
const { search } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

function makeBubbles(ids) {
  return JSON.stringify({ bubbles: [ { results: ids.map((id) => ({ id })) } ] });
}

function makeLookup(ids) {
  return JSON.stringify({ results: ids.map((id) => ({ trackId: id, bundleId: `app.${id}`, trackName: `App ${id}`, trackViewUrl: `https://apps.apple.com/app/${id}`, description: 'd', price: 0, currency: 'USD', artistId: 1, artistName: 'Dev' })) });
}

describe('M2: search', () => {
  afterEach(() => resetFetch());

  it('returns application list', async () => {
    const ids = ['1', '2'];
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: makeLookup(ids) };
        return { status: 404, body: '' };
      }),
    );
    const apps = await search({ term: 'Panda', num: 2 });
    expect(apps).to.have.length(2);
    expect(apps[0].title).to.equal('App 1');
  });

  it('paginates properly', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        if (url.startsWith('https://itunes.apple.com/lookup')) {
          const qs = new URL(url).searchParams;
          const list = (qs.get('id') || '').split(',').filter(Boolean);
          return { body: makeLookup(list) };
        }
        return { status: 404, body: '' };
      }),
    );
    const p1 = await search({ term: 'Panda', num: 10, page: 1 });
    const p2 = await search({ term: 'Panda', num: 10, page: 2 });
    expect(p1).to.have.length(10);
    expect(p2).to.have.length(10);
    expect(p1[0].appId).to.not.equal(p2[0].appId);
  });

  it('idsOnly returns array of ids', async () => {
    const ids = ['10', '11', '12'];
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('/wa/search?')) return { body: makeBubbles(ids) };
        return { status: 404, body: '' };
      }),
    );
    const res = await search({ term: 'vr', idsOnly: true, num: 3 });
    expect(res).to.deep.equal(ids);
  });
});


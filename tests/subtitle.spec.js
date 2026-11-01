const { expect } = require('chai');
const store = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

const CATALOG = 'https://apps.apple.com/api/apps/v1/catalog/';

function lookupBody(ids) {
  return JSON.stringify({ results: ids.map((id) => ({ trackId: Number(id), trackName: `App ${id}`, screenshotUrls: ['s'] })) });
}

// Catalog response: app 1 has an iOS subtitle, 2 is Mac-only, 3 has none.
function catalogBody(ids) {
  const platforms = { 1: { ios: { subtitle: 'iOS tagline' } }, 2: { osx: { subtitle: 'Mac tagline' } }, 3: { ios: {} } };
  return JSON.stringify({ data: ids.map((id) => ({ id: String(id), attributes: { platformAttributes: platforms[id] || { ios: { subtitle: `Sub ${id}` } } } })) });
}

// Stubs search + lookup + catalog; records every catalog URL.
function stub({ catalogStatus = 200 } = {}) {
  const catalogUrls = [];
  __setFetchForTests(mockFetch((url) => {
    if (url.includes('/wa/search?')) return { body: JSON.stringify({ bubbles: [{ results: ['1', '2', '3'].map((id) => ({ id })) }] }) };
    if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody(new URL(url).searchParams.get('id').split(',')) };
    if (url.startsWith(CATALOG)) {
      catalogUrls.push(url);
      return { status: catalogStatus, body: catalogStatus === 200 ? catalogBody(new URL(url).searchParams.get('ids').split(',')) : '' };
    }
    return { status: 404, body: '' };
  }));
  return catalogUrls;
}

describe('subtitle option', () => {
  afterEach(() => resetFetch());

  it('is off by default: no subtitle field and no catalog request', async () => {
    const catalogUrls = stub();
    const app = await store.app({ id: '1' });
    expect(app).to.not.have.property('subtitle');
    expect(catalogUrls).to.be.empty;
  });

  it('app: sets the iOS subtitle from the catalog, for the right storefront', async () => {
    const catalogUrls = stub();
    const app = await store.app({ id: '1', country: 'FR', subtitle: true });
    expect(app.subtitle).to.equal('iOS tagline');
    expect(catalogUrls[0]).to.include('/catalog/fr/apps?ids=1&platform=web&additionalPlatforms=iphone,mac');
  });

  it('search: one catalog request for all results; Mac subtitle for Mac-only apps; none when Apple has none', async () => {
    const catalogUrls = stub();
    const apps = await store.search({ term: 'x', subtitle: true });
    expect(apps.map((a) => a.subtitle)).to.deep.equal(['iOS tagline', 'Mac tagline', undefined]);
    expect(catalogUrls).to.have.length(1);
  });

  it('splits into requests of at most 99 ids', async () => {
    const catalogUrls = stub();
    const ids = Array.from({ length: 150 }, (_, i) => String(i + 10));
    __setFetchForTests(mockFetch((url) => {
      if (url.includes('/RSS/')) return { body: JSON.stringify({ feed: { entry: ids.map((id) => ({ id: { attributes: { 'im:id': id } } })) } }) };
      if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody(new URL(url).searchParams.get('id').split(',')) };
      if (url.startsWith(CATALOG)) {
        catalogUrls.push(url);
        return { body: catalogBody(new URL(url).searchParams.get('ids').split(',')) };
      }
      return { status: 404, body: '' };
    }));
    const apps = await store.list({ num: 150, fullDetail: true, subtitle: true });
    expect(catalogUrls.map((u) => new URL(u).searchParams.get('ids').split(',').length)).to.deep.equal([99, 51]);
    expect(apps.every((a) => a.subtitle === `Sub ${a.id}`)).to.equal(true);
  });

  it('a failed catalog request leaves subtitle unset instead of failing the call', async () => {
    stub({ catalogStatus: 400 });
    const apps = await store.search({ term: 'x', subtitle: true });
    expect(apps).to.have.length(3);
    expect(apps.every((a) => a.subtitle === undefined)).to.equal(true);
  });
});

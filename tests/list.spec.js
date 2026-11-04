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

  it('parses developerId without the artist URL query string', async () => {
    const entry = (id, href) => ({ id: { attributes: { 'im:id': id, 'im:bundleId': `app.${id}` } }, 'im:name': { label: id }, 'im:image': [{ label: 'a' }], link: [{ attributes: { rel: 'alternate', href: `https://apps.apple.com/app/${id}` } }], 'im:price': { attributes: { amount: '0', currency: 'USD' } }, 'im:artist': { label: 'Dev', attributes: { href } } });
    const rss = JSON.stringify({ feed: { entry: [
      entry('1', 'https://apps.apple.com/us/developer/new-york-road-runners-inc/id1161512269?uo=2'),
      entry('2', 'https://itunes.apple.com/us/artist/dev/id9?mt=8&uo=2'),
    ] } });
    __setFetchForTests(mockFetch((url) => (url.includes('/ws/RSS/') ? { body: rss } : { status: 404, body: '' })));
    const apps = await list({ collection: constants.collection.TOP_FREE_IOS, num: 2 });
    expect(apps.map((a) => a.developerId)).to.deep.equal(['1161512269', '9']);
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


describe('list: single-entry feed', () => {
  afterEach(() => resetFetch());

  it('handles feed.entry returned as an object (Apple does this for one result)', async () => {
    const rss = JSON.stringify({ feed: { entry: { id: { attributes: { 'im:id': '1', 'im:bundleId': 'app.one' } }, 'im:name': { label: 'App One' } } } });
    __setFetchForTests(mockFetch((url) => (url.includes('/ws/RSS/') ? { body: rss } : { status: 404, body: '' })));
    const apps = await list({ collection: constants.collection.TOP_FREE_IOS, num: 1 });
    expect(apps).to.have.length(1);
    expect(apps[0].title).to.equal('App One');
  });
});

describe('list: ranks past 100 from the apps.apple.com chart page', () => {
  const fs = require('fs');
  const path = require('path');
  const PAGE = fs.readFileSync(path.join(__dirname, 'fixtures/chart-page-us-6007.html'), 'utf8');
  const PAGE_URL = 'https://apps.apple.com/us/iphone/charts/6007';
  const { PRODUCTIVITY } = constants.category;
  const { TOP_FREE_IOS, TOP_PAID_IOS } = constants.collection;
  const segment = (chart) => JSON.parse(PAGE.match(/id="serialized-server-data">([\s\S]*?)<\/script>/)[1]).data[0].data.segments.find((s) => s.chart === chart);
  const ids = (chart) => [...segment(chart).shelves[0].items.map((i) => i.adamId), ...segment(chart).nextPage.remainingContent.map((r) => r.id)];
  // Bundles in the fixture (ranked on the page, absent from RSS): top-free ranks 25 and 104, top-paid 22, 88, 90 and 105.
  // Those within RSS's range are skipped as page-only entries; those past it are dropped by type.
  const BUNDLES = ['1814195639', '6810417888', '1195425695', '939827136', '921185227', '1054542401'];
  const apps = (chart) => ids(chart).filter((id) => !BUNDLES.includes(id));

  const rssBody = (list) => JSON.stringify({ feed: { entry: list.map((id) => ({ id: { attributes: { 'im:id': id } }, 'im:name': { label: `RSS ${id}` } })) } });
  const lookupBody = (url) => JSON.stringify({ results: new URL(url).searchParams.get('id').split(',').map((id) => ({ trackId: Number(id), trackName: `Lookup ${id}`, artistId: 9, primaryGenreId: 6007, price: 0 })) });

  function stub({ rss, page = { body: PAGE }, lookup }) {
    const urls = [];
    __setFetchForTests(mockFetch((url) => {
      urls.push(url);
      if (url.includes('/ws/RSS/')) return { body: rssBody(rss) };
      if (url.startsWith('https://apps.apple.com/')) return page;
      if (url.startsWith('https://itunes.apple.com/lookup')) return lookup ?? { body: lookupBody(url) };
      return { status: 404, body: '' };
    }));
    return urls;
  }

  afterEach(() => resetFetch());

  it('top free: RSS gives ranks 1-100, the page the rest (bundles skipped), one lookup fills them in', async () => {
    expect(apps('top-free')).to.have.length(198);
    const urls = stub({ rss: apps('top-free').slice(0, 100) });
    const res = await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 200 });
    expect(res.map((a) => a.id)).to.deep.equal(apps('top-free'));
    expect(res[99].title).to.equal(`RSS ${res[99].id}`);
    expect(res[100]).to.include({ title: `Lookup ${res[100].id}`, developerId: '9', genreId: '6007', free: true });
    expect(urls.filter((u) => u.startsWith(PAGE_URL))).to.have.length(1);
    const lookups = urls.filter((u) => u.includes('/lookup'));
    expect(lookups).to.have.length(1);
    expect(new URL(lookups[0]).searchParams.get('id').split(',')).to.deep.equal(apps('top-free').slice(100));
  });

  it('num caps the total; fullDetail looks all ranks up in one request, in order', async () => {
    stub({ rss: apps('top-free').slice(0, 100) });
    expect(await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 150 })).to.have.length(150);
    const urls = stub({ rss: apps('top-free').slice(0, 100) });
    const full = await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 200, fullDetail: true });
    expect(full.map((a) => String(a.id))).to.deep.equal(apps('top-free'));
    expect(urls.filter((u) => u.includes('/lookup'))).to.have.length(1);
  });

  it('top paid: an app only on the page within the RSS range is skipped, so ranks 1-99 stay the RSS ones', async () => {
    // Apple's RSS drops some apps the page still ranks (seen: paid apps that just went free).
    const pageOnly = apps('top-paid')[30];
    const rss = apps('top-paid').filter((id) => id !== pageOnly).slice(0, 99);
    stub({ rss });
    const res = await list({ collection: TOP_PAID_IOS, category: PRODUCTIVITY, num: 200 });
    expect(res.map((a) => a.id)).to.deep.equal([...rss, ...apps('top-paid').slice(100)]);
    expect(res.map((a) => a.id)).to.not.include(pageOnly);
  });

  const rss100 = () => apps('top-free').slice(0, 100);
  const FALLBACKS = [
    ['page answers 404', () => ({ rss: rss100(), page: { status: 404, body: '' } })],
    ['no serialized-server-data script (page redesigned)', () => ({ rss: rss100(), page: { body: PAGE.replace('serialized-server-data', 'server-data') } })],
    ['segments renamed (data shape changed)', () => ({ rss: rss100(), page: { body: PAGE.replace('"segments"', '"charts"') } })],
    ['ids in another format (page redesigned)', () => ({ rss: rss100(), page: { body: PAGE.replace(/"id":"(\d+)"/g, '"id":"app-$1"') } })],
    ['page order disagrees with RSS', () => { const r = rss100(); [r[3], r[4]] = [r[4], r[3]]; return { rss: r }; }],
    ['RSS returned nothing to check the page against', () => ({ rss: [] })],
    ['lookup of ranks 101+ fails', () => ({ rss: rss100(), lookup: { status: 404, body: '' } })],
  ];
  for (const [name, setup] of FALLBACKS) {
    it(`falls back to the RSS result, without throwing: ${name}`, async () => {
      const s = setup();
      stub(s);
      const res = await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 200 });
      expect(res.map((a) => a.id)).to.deep.equal(s.rss);
    });
  }

  it('reads only RSS for num <= 100, other collections and the overall top paid chart', async () => {
    const urls = stub({ rss: rss100() });
    await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 100 });
    await list({ collection: constants.collection.TOP_GROSSING_IOS, category: PRODUCTIVITY, num: 200 });
    await list({ collection: constants.collection.TOP_FREE_IPAD, category: PRODUCTIVITY, num: 200 });
    await list({ collection: TOP_PAID_IOS, num: 200 });
    expect(urls.filter((u) => !u.includes('/ws/RSS/'))).to.deep.equal([]);
  });

  it('overall top free (no category) reads the "All Apps" chart, genre 36, of the lowercased storefront', async () => {
    const urls = stub({ rss: rss100(), page: { status: 404, body: '' } });
    await list({ collection: TOP_FREE_IOS, num: 200, country: 'FR' });
    expect(urls).to.include('https://apps.apple.com/fr/iphone/charts/36');
  });

  it('a cancelled call rejects instead of returning the RSS fallback', async () => {
    const controller = new AbortController();
    __setFetchForTests(mockFetch((url) => {
      if (url.includes('/ws/RSS/')) return { body: rssBody(rss100()) };
      if (url.startsWith('https://apps.apple.com/')) return { body: PAGE };
      controller.abort(); // during the lookup of ranks 101+
      return { status: 404, body: '' };
    }));
    let err;
    await list({ collection: TOP_FREE_IOS, category: PRODUCTIVITY, num: 200, requestOptions: { signal: controller.signal } }).catch((e) => (err = e));
    expect(err?.name).to.equal('AbortError');
  });
});

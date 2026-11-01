const { expect } = require('chai');
const store = require('../../dist/cjs');

// Hits Apple for real: catches endpoint/page changes that stubbed tests can't. Opt in with INTEGRATION=1.
const CANDY_CRUSH = '553834731';
const KING = '526656015';
const PAGES = '361309726'; // Apple's Pages: stable privacy labels and long version history
const FINAL_CUT_PRO = '424389933'; // Mac-only: subtitle lives under `osx`, not `ios`

describe('Integration (live Apple endpoints)', function () {
  this.timeout(30000);

  if (process.env.INTEGRATION !== '1') {
    it('skipped (set INTEGRATION=1 to enable)', function () {
      this.skip();
    });
    return;
  }

  it('app', async () => {
    const app = await store.app({ id: CANDY_CRUSH, ratings: true });
    expect(app.title).to.be.a('string');
    expect(app.screenshots).to.not.be.empty;
    expect(app.ratings).to.be.greaterThan(1000);
  });

  it('subtitle (catalog API), iOS and Mac-only', async () => {
    const [candy] = await store.search({ term: 'candy crush saga', num: 1, subtitle: true });
    expect(candy.subtitle).to.be.a('string').and.not.empty;
    const finalCut = await store.app({ id: FINAL_CUT_PRO, subtitle: true });
    expect(finalCut.subtitle).to.be.a('string').and.not.empty;
  });

  it('app by bundle id', async () => {
    const app = await store.app({ appId: 'com.midasplayer.apps.candycrushsaga' });
    expect(String(app.id)).to.equal(CANDY_CRUSH);
  });

  it('ratings', async () => {
    const res = await store.ratings({ id: CANDY_CRUSH });
    expect(res.ratings).to.be.greaterThan(1000);
    expect(Object.keys(res.histogram)).to.have.members(['1', '2', '3', '4', '5']);
  });

  it('list', async () => {
    const apps = await store.list({ num: 5, category: store.constants.category.GAMES });
    expect(apps).to.have.length(5);
    expect(apps[0]).to.have.property('appId');
  });

  it('search', async () => {
    const apps = await store.search({ term: 'candy crush', num: 3 });
    expect(apps).to.not.be.empty;
    expect(apps[0]).to.have.property('title');
  });

  it('developer', async () => {
    const apps = await store.developer({ devId: KING });
    expect(apps).to.not.be.empty;
  });

  it('suggest', async () => {
    const terms = await store.suggest({ term: 'pan' });
    expect(terms).to.not.be.empty;
    expect(terms[0].term).to.be.a('string');
  });

  it('similar', async () => {
    const apps = await store.similar({ id: CANDY_CRUSH });
    expect(apps).to.not.be.empty;
  });

  it('reviews', async () => {
    const reviews = await store.reviews({ id: CANDY_CRUSH });
    expect(reviews).to.not.be.empty;
    expect(reviews[0].score).to.be.within(1, 5);
  });

  it('privacy', async () => {
    const details = await store.privacy({ id: PAGES });
    expect(details.privacyTypes).to.not.be.empty;
  });

  it('versionHistory', async () => {
    const history = await store.versionHistory({ id: PAGES });
    expect(history.length).to.be.greaterThan(5);
  });

  it('unknown app id throws NotFoundError', async () => {
    await store.privacy({ id: '1' }).then(() => { throw new Error('should fail'); }, (e) => expect(e).to.be.instanceOf(store.NotFoundError));
  });
});

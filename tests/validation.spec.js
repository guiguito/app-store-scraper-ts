const { expect } = require('chai');
const store = require('../dist/cjs');

// Every method validates its input before any request is made.
const cases = [
  ['app without id/appId', () => store.app({}), 'Either id or appId is required'],
  ['app without options', () => store.app(), 'Either id or appId is required'],
  ['ratings without id', () => store.ratings({}), 'id is required'],
  ['search without term', () => store.search({}), 'term is required'],
  ['suggest without term', () => store.suggest({}), 'term missing'],
  ['developer without devId', () => store.developer({}), 'devId is required'],
  ['similar without id/appId', () => store.similar({}), 'Either id or appId is required'],
  ['privacy without id', () => store.privacy({}), 'id is required'],
  ['versionHistory without id', () => store.versionHistory({}), 'id is required'],
  ['inAppPurchases without id', () => store.inAppPurchases({}), 'id is required'],
  ['reviews without id/appId', () => store.reviews({}), 'Either id or appId is required'],
  ['reviews with invalid sort', () => store.reviews({ id: 1, sort: 'newest' }), 'Invalid sort newest'],
  ['reviews with page < 1', () => store.reviews({ id: 1, page: -1 }), 'Page cannot be lower than 1'],
  ['reviews with page > 10', () => store.reviews({ id: 1, page: 11 }), 'Page cannot be greater than 10'],
  ['list with invalid collection', () => store.list({ collection: 'nope' }), 'Invalid collection nope'],
  ['list with invalid category', () => store.list({ category: 1 }), 'Invalid category 1'],
  ['list with num > 200', () => store.list({ num: 201 }), 'Cannot retrieve more than 200 apps'],
];

describe('input validation', () => {
  for (const [label, call, message] of cases) {
    it(`${label} throws ValidationError`, async () => {
      await call().then(() => { throw new Error('should fail'); }, (e) => {
        expect(e).to.be.instanceOf(store.ValidationError);
        expect(e.message).to.equal(message);
      });
    });
  }
});

const { expect } = require('chai');
const store = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

function expectRejection(promise, check) {
  return promise.then(() => { throw new Error('should fail'); }, check);
}

describe('errors', () => {
  afterEach(() => resetFetch());

  it('exports the error classes from the package root', () => {
    for (const name of ['HttpError', 'NotFoundError', 'ValidationError']) expect(store[name]).to.be.a('function');
  });

  it('thrown errors are instances of the exported classes', async () => {
    await expectRejection(store.app({}), (e) => expect(e).to.be.instanceOf(store.ValidationError));
  });

  // Apple answers 404 for unknown app ids on these endpoints.
  for (const [name, call] of [
    ['privacy', () => store.privacy({ id: '1' })],
    ['versionHistory', () => store.versionHistory({ id: '1' })],
    ['ratings', () => store.ratings({ id: '1' })],
    ['inAppPurchases', () => store.inAppPurchases({ id: '1' })],
  ]) {
    it(`${name}: unknown id throws NotFoundError`, async () => {
      __setFetchForTests(mockFetch(() => ({ status: 404, body: '' })));
      await expectRejection(call(), (e) => expect(e).to.be.instanceOf(store.NotFoundError));
    });
  }

  it('other HTTP failures still surface as HttpError', async () => {
    __setFetchForTests(mockFetch(() => ({ status: 403, body: '' })));
    await expectRejection(store.privacy({ id: '1' }), (e) => {
      expect(e).to.be.instanceOf(store.HttpError);
      expect(e.statusCode).to.equal(403);
    });
  });

  it('developer: unknown devId throws NotFoundError', async () => {
    __setFetchForTests(mockFetch(() => ({ body: JSON.stringify({ results: [] }) })));
    await expectRejection(store.developer({ devId: '1' }), (e) => {
      expect(e).to.be.instanceOf(store.NotFoundError);
      expect(e.message).to.equal('Developer not found (404)');
    });
  });
});

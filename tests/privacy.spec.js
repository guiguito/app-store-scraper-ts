const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { privacy } = require('../dist/cjs/modules/privacy');

describe('M3: privacy', () => {
  afterEach(() => resetFetch());

  it('retrieves privacy details in a single token-free request', async () => {
    const api = JSON.stringify({ data: [ { attributes: { privacyDetails: { managePrivacyChoicesUrl: null, privacyTypes: [ { privacyType: 'Data Used to Track You', identifier: 'DATA_USED_TO_TRACK_YOU', description: '...', dataCategories: [], purposes: [] } ] } } } ] });
    const calls = [];
    __setFetchForTests(
      mockFetch((url, init) => {
        calls.push({ url, init });
        if (url.startsWith('https://apps.apple.com/api/apps/v1/catalog/')) return { body: api };
        return { status: 404, body: '' };
      }),
    );

    const res = await privacy({ id: '324684580', country: 'FR' });
    expect(res.privacyTypes.length).to.be.greaterThan(0);
    expect(res.managePrivacyChoicesUrl).to.equal(null);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.equal('https://apps.apple.com/api/apps/v1/catalog/fr/apps/324684580?platform=web&fields=privacyDetails');
    expect(calls[0].init.headers).to.not.have.property('Authorization');
  });

  it('throws ValidationError when called without options', async () => {
    await privacy().then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('ValidationError'));
  });

  it('throws NotFoundError when the catalog returns no data', async () => {
    __setFetchForTests(mockFetch(() => ({ body: JSON.stringify({ data: [] }) })));
    await privacy({ id: '1' }).then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('NotFoundError'));
  });
});

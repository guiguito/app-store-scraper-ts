const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { privacy } = require('../dist/cjs/modules/privacy');

describe('M3: privacy (tests first)', () => {
  afterEach(() => resetFetch());

  it('retrieves privacy details', async () => {
    const html = '... token%22%3A%22TOKEN123%22%7D ...';
    const api = JSON.stringify({ data: [ { attributes: { privacyDetails: { managePrivacyChoicesUrl: null, privacyTypes: [ { privacyType: 'Data Used to Track You', identifier: 'DATA_USED_TO_TRACK_YOU', description: '...', dataCategories: [], purposes: [] } ] } } } ] });

    let calls = 0;
    __setFetchForTests(
      mockFetch(() => {
        calls += 1;
        if (calls === 1) return { body: html };
        if (calls === 2) return { body: api };
        return { status: 404, body: '' };
      }),
    );

    const res = await privacy({ id: '324684580' });
    expect(res.privacyTypes.length).to.be.greaterThan(0);
    expect(res.managePrivacyChoicesUrl).to.equal(null);
  });
});

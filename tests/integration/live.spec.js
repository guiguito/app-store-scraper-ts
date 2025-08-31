const { expect } = require('chai');
const store = require('../../dist/cjs');

describe('Integration (optional)', () => {
  if (process.env.INTEGRATION !== '1') {
    it('skipped (set INTEGRATION=1 to enable)', function () {
      this.skip();
    });
    return;
  }

  it('search returns results from live endpoint', async () => {
    const apps = await store.search({ term: 'panda', num: 1 });
    expect(apps).to.be.an('array');
    if (apps.length) {
      expect(apps[0]).to.have.property('appId');
      expect(apps[0]).to.have.property('title');
    }
  });
});

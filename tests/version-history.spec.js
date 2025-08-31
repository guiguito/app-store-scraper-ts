const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { versionHistory } = require('../dist/cjs/modules/version-history');

describe('M3: versionHistory (tests first)', () => {
  afterEach(() => resetFetch());

  it('retrieves version history', async () => {
    const html = '... token%22%3A%22TOKEN123%22%7D ...';
    const api = JSON.stringify({ data: [ { attributes: { platformAttributes: { ios: { versionHistory: [ { versionDisplay: '1.0.0', releaseNotes: 'notes', releaseDate: '2024-01-01', releaseTimestamp: '2024-01-01T00:00:00Z' } ] } } } } ] });

    let calls = 0;
    __setFetchForTests(
      mockFetch(() => {
        calls += 1;
        if (calls === 1) return { body: html };
        if (calls === 2) return { body: api };
        return { status: 404, body: '' };
      }),
    );

    const res = await versionHistory({ id: '324684580' });
    expect(res.length).to.be.greaterThan(0);
    expect(res[0].versionDisplay).to.equal('1.0.0');
  });
});

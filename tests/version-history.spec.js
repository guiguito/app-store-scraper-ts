const { expect } = require('chai');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');
const { versionHistory } = require('../dist/cjs/modules/version-history');

function catalog(platformAttributes) {
  return JSON.stringify({ data: [ { attributes: { platformAttributes } } ] });
}
const entry = { versionDisplay: '1.0.0', releaseNotes: 'notes', releaseDate: '2024-01-01', releaseTimestamp: '2024-01-01T00:00:00Z' };

describe('M3: versionHistory', () => {
  afterEach(() => resetFetch());

  it('retrieves version history in a single token-free request', async () => {
    const urls = [];
    __setFetchForTests(
      mockFetch((url) => {
        urls.push(url);
        if (url.startsWith('https://apps.apple.com/api/apps/v1/catalog/us/apps/324684580?')) return { body: catalog({ ios: { versionHistory: [entry] } }) };
        return { status: 404, body: '' };
      }),
    );

    const res = await versionHistory({ id: '324684580' });
    expect(res).to.have.length(1);
    expect(res[0].versionDisplay).to.equal('1.0.0');
    expect(urls).to.have.length(1);
    expect(urls[0]).to.include('extend=versionHistory');
  });

  it('handles Mac-only apps (history under osx, no ios key)', async () => {
    __setFetchForTests(mockFetch(() => ({ body: catalog({ osx: { versionHistory: [entry] } }) })));
    const res = await versionHistory({ id: '497799835' });
    expect(res[0].versionDisplay).to.equal('1.0.0');
  });

  it('throws ValidationError when called without options', async () => {
    await versionHistory().then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('ValidationError'));
  });

  it('throws NotFoundError when the catalog returns no data', async () => {
    __setFetchForTests(mockFetch(() => ({ body: JSON.stringify({ data: [] }) })));
    await versionHistory({ id: '1' }).then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('NotFoundError'));
  });
});

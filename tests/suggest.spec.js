const { expect } = require('chai');
const { suggest } = require('../dist/cjs');
const { __setFetchForTests } = require('../dist/cjs/http/client');
const { mockFetch, resetFetch } = require('./helpers');

function makeSuggestXml(terms) {
  const items = terms.map((t) => `<dict><string>${t}</string></dict>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
  <plist>
    <dict><array>${items}</array></dict>
  </plist>`;
}

describe('M2: suggest', () => {
  afterEach(() => resetFetch());

  it('returns suggestions', async () => {
    const xml = makeSuggestXml(['p', 'panda', 'panda games']);
    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('MZSearchHints')) return { body: xml };
        return { status: 404, body: '' };
      }),
    );
    const res = await suggest({ term: 'p' });
    expect(res.map((r) => r.term)).to.deep.equal(['p', 'panda', 'panda games']);
  });
});


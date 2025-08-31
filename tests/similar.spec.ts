import { expect } from 'chai';
import { developer, list, search, suggest } from '../src';
import { __setFetchForTests } from '../src/http/client';
import { mockFetch, resetFetch } from './helpers';
import { similar } from '../src/modules/similar';

describe('M3: similar (tests first)', () => {
  afterEach(() => resetFetch());

  it('returns similar apps via lookup ids', async () => {
    const html = '... customersAlsoBoughtApps": ["1","2","3"]';
    const lookupBody = JSON.stringify({ results: [
      { trackId: '1', bundleId: 'app.1', trackName: 'One', trackViewUrl: 'https://apps.apple.com/app/1', description: 'd', price: 0, currency: 'USD', artistId: 'd1', artistName: 'Dev1' },
      { trackId: '2', bundleId: 'app.2', trackName: 'Two', trackViewUrl: 'https://apps.apple.com/app/2', description: 'd', price: 0, currency: 'USD', artistId: 'd2', artistName: 'Dev2' }
    ] });

    __setFetchForTests(
      mockFetch((url) => {
        if (url.includes('itunes.apple.com') && url.includes('/app/id')) return { body: html };
        if (url.startsWith('https://itunes.apple.com/lookup')) return { body: lookupBody };
        return { status: 404, body: '' };
      }) as any,
    );
    const res = await similar({ id: '553834731' });
    expect(res.length).to.be.greaterThan(0);
    expect(res[0].appId).to.equal('app.1');
  });
});


const { expect } = require('chai');

const {
  HttpClient,
  __setProxyAgentFactoryForTests,
  setProxyUsageListener,
} = require('../dist/cjs/http/client');

describe('HttpClient proxy handling', () => {
  afterEach(() => {
    __setProxyAgentFactoryForTests();
    setProxyUsageListener(undefined);
  });

  it('routes through HTTPS proxies and propagates TLS settings', async () => {
    const snapshots = [];
    __setProxyAgentFactoryForTests((config, options) => {
      snapshots.push({ config, options });
      return { dispatcher: { config, options } };
    });
    const client = new HttpClient({ proxy: { url: 'https://user:pass@proxy.local:8443', rejectUnauthorized: false } });
    const events = [];
    setProxyUsageListener((event) => events.push(event));

    let receivedDispatcher;
    client.setFetchImpl(async (_url, init) => {
      receivedDispatcher = init.dispatcher;
      return {
        ok: true,
        text: async () => 'ok',
      };
    });

    const body = await client.request('https://apps.apple.com/us/app/test/id123');
    expect(body).to.equal('ok');
    expect(receivedDispatcher).to.be.an('object');
    expect(snapshots).to.have.lengthOf(1);
    expect(snapshots[0].config.protocol).to.equal('https');
    expect(snapshots[0].config.rejectUnauthorized).to.equal(false);
    expect(snapshots[0].options).to.have.nested.property('requestTls.rejectUnauthorized', false);
    expect(snapshots[0].options).to.have.nested.property('proxyTls.rejectUnauthorized', false);

    expect(events).to.have.lengthOf(1);
    const event = events[0];
    expect(event.viaProxy).to.equal(true);
    expect(event.reason).to.equal('proxy');
    expect(event.proxy).to.be.an('object');
    expect(event.proxy.protocol).to.equal('https');
    expect(event.proxy.hasCredentials).to.equal(true);
    expect(event.proxy.rejectUnauthorized).to.equal(false);
  });

  it('falls back to direct routing when proxy setup fails', async () => {
    __setProxyAgentFactoryForTests(() => ({ error: new Error('boom'), reason: 'boom' }));
    const client = new HttpClient({ proxy: 'http://proxy.local:3128' });
    const events = [];
    setProxyUsageListener((event) => events.push(event));

    let dispatcherSeen;
    client.setFetchImpl(async (_url, init) => {
      dispatcherSeen = init.dispatcher;
      return {
        ok: true,
        text: async () => 'ok',
      };
    });

    await client.request('https://example.com/resource');
    expect(dispatcherSeen).to.be.undefined;
    expect(events).to.have.lengthOf(1);
    const event = events[0];
    expect(event.viaProxy).to.equal(false);
    expect(event.reason).to.equal('boom');
    expect(event.proxy).to.be.an('object');
    expect(event.proxy.protocol).to.equal('http');
    expect(event.error).to.be.an('error');
  });

  it('supports per-request proxy overrides with TLS flags', async () => {
    const snapshots = [];
    __setProxyAgentFactoryForTests((config, options) => {
      snapshots.push({ config, options });
      return { dispatcher: { config, options } };
    });
    const client = new HttpClient();
    const events = [];
    setProxyUsageListener((event) => events.push(event));

    client.setFetchImpl(async () => ({
      ok: true,
      text: async () => 'ok',
    }));

    await client.request('https://itunes.apple.com/lookup', {}, {
      proxy: 'https://proxy.test:9443',
      rejectUnauthorized: false,
    });

    expect(snapshots).to.have.lengthOf(1);
    expect(snapshots[0].config.protocol).to.equal('https');
    expect(snapshots[0].config.port).to.equal('9443');
    expect(snapshots[0].options).to.have.nested.property('proxyTls.rejectUnauthorized', false);
    expect(events).to.have.lengthOf(1);
    expect(events[0].proxy.protocol).to.equal('https');
    expect(events[0].viaProxy).to.equal(true);
  });

  it('routes via country proxies with direct fallback', async () => {
    const snapshots = [];
    __setProxyAgentFactoryForTests((config, options) => {
      snapshots.push({ config, options });
      return { dispatcher: { config, options } };
    });
    const client = new HttpClient();
    client.setCountryProxies({
      us: 'https://us-proxy.local:8443',
      FR: { url: 'http://fr-proxy.local:3128', rejectUnauthorized: false },
    });

    const events = [];
    setProxyUsageListener((event) => events.push(event));

    const dispatchers = [];
    client.setFetchImpl(async (_url, init) => {
      dispatchers.push(init.dispatcher);
      return {
        ok: true,
        text: async () => 'ok',
      };
    });

    await client.request('https://example.com/us', {}, { country: 'us' });
    await client.request('https://example.com/fr', {}, { country: 'fr' });
    await client.request('https://example.com/de', {}, { country: 'de' });

    expect(snapshots).to.have.lengthOf(2);
    expect(snapshots[0].config.host).to.equal('us-proxy.local');
    expect(snapshots[1].config.host).to.equal('fr-proxy.local');
    expect(snapshots[1].options).to.have.nested.property('requestTls.rejectUnauthorized', false);

    expect(dispatchers[0]).to.exist;
    expect(dispatchers[1]).to.exist;
    expect(dispatchers[2]).to.be.undefined;

    expect(events).to.have.lengthOf(3);
    expect(events[0].viaProxy).to.equal(true);
    expect(events[0].country).to.equal('US');
    expect(events[1].viaProxy).to.equal(true);
    expect(events[1].country).to.equal('FR');
    expect(events[1].proxy.rejectUnauthorized).to.equal(false);
    expect(events[2].viaProxy).to.equal(false);
    expect(events[2].country).to.equal('DE');
  });
});

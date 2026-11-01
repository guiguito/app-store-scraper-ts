const { expect } = require('chai');
const http = require('http');
const net = require('net');

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

// No stubs: exercises the real undici ProxyAgent + fetch pairing against an in-process CONNECT proxy.
describe('HttpClient real proxy tunnel', () => {
  it('tunnels requests through an HTTP CONNECT proxy', async () => {
    const sockets = [];
    let tunnels = 0;
    const target = http.createServer((_req, res) => res.end('via-proxy'));
    const proxy = http.createServer();
    proxy.on('connect', (req, client, head) => {
      tunnels += 1;
      const [host, port] = req.url.split(':');
      const upstream = net.connect(Number(port), host, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => client.destroy());
      sockets.push(client, upstream);
    });
    await Promise.all([target, proxy].map((s) => new Promise((resolve) => s.listen(0, '127.0.0.1', resolve))));
    try {
      const client = new HttpClient({ proxy: `http://127.0.0.1:${proxy.address().port}`, retry: { retries: 1 } });
      expect(await client.request(`http://127.0.0.1:${target.address().port}/`)).to.equal('via-proxy');
      expect(tunnels).to.equal(1);
    } finally {
      sockets.forEach((s) => s.destroy());
      target.closeAllConnections();
      target.close();
      proxy.close();
    }
  });
});

// Fake fetch that serves `responses` in order ({ status, headers, body } or an Error to throw).
function sequence(responses, seen = []) {
  return async (url, init) => {
    seen.push({ url, init, at: Date.now() });
    const next = responses[Math.min(seen.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    const status = next.status ?? 200;
    return { status, ok: status < 300, headers: new Headers(next.headers || {}), text: async () => next.body ?? 'ok' };
  };
}

describe('HttpClient retry policy', () => {
  afterEach(() => setProxyUsageListener(undefined));
  const fast = { retries: 3, minDelayMs: 1, maxDelayMs: 5000 };

  it('honors Retry-After in seconds on 429', async () => {
    const seen = [];
    const client = new HttpClient({ retry: fast, fetchImpl: sequence([{ status: 429, headers: { 'Retry-After': '0.3' } }, {}], seen) });
    expect(await client.request('https://example.com/')).to.equal('ok');
    expect(seen[1].at - seen[0].at).to.be.at.least(280);
  });

  it('honors Retry-After as an HTTP date', async () => {
    const seen = [];
    const until = new Date(Date.now() + 1500).toUTCString(); // second resolution: 0.5s..1.5s away
    const client = new HttpClient({ retry: fast, fetchImpl: sequence([{ status: 503, headers: { 'retry-after': until } }, {}], seen) });
    await client.request('https://example.com/');
    expect(seen[1].at - seen[0].at).to.be.at.least(400);
  });

  it('does not retry 4xx other than 429', async () => {
    const seen = [];
    const client = new HttpClient({ retry: fast, fetchImpl: sequence([{ status: 404 }], seen) });
    await client.request('https://example.com/').then(() => { throw new Error('should fail'); }, (e) => expect(e.statusCode).to.equal(404));
    expect(seen).to.have.length(1);
  });

  it('gives up after `retries` attempts and surfaces the last error', async () => {
    const seen = [];
    const client = new HttpClient({ retry: { retries: 3, minDelayMs: 1, maxDelayMs: 5 }, fetchImpl: sequence([{ status: 503 }], seen) });
    await client.request('https://example.com/').then(() => { throw new Error('should fail'); }, (e) => expect(e.statusCode).to.equal(503));
    expect(seen).to.have.length(3);
  });

  it('aborts a hung request after timeoutMs and retries it', async () => {
    let calls = 0;
    const client = new HttpClient({ retry: fast });
    client.setFetchImpl((_url, init) => {
      calls += 1;
      if (calls > 1) return Promise.resolve({ ok: true, text: async () => 'ok' });
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    });
    expect(await client.request('https://example.com/', {}, { timeoutMs: 50 })).to.equal('ok');
    expect(calls).to.equal(2);
  });

  // Fake fetch that hangs until its signal aborts, like a slow Apple endpoint.
  function hanging(counter) {
    return (_url, init) => {
      counter.calls += 1;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    };
  }

  it('signal: cancels an in-flight request with the abort reason and never retries it', async () => {
    const counter = { calls: 0 };
    // Long retry delays: a cancel that went through the retry path would take seconds.
    const client = new HttpClient({ retry: { retries: 3, minDelayMs: 5000, maxDelayMs: 5000 }, fetchImpl: hanging(counter) });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    const started = Date.now();
    await client.request('https://example.com/', {}, { signal: controller.signal })
      .then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('AbortError'));
    expect(Date.now() - started).to.be.below(1000);
    expect(counter.calls).to.equal(1);
  });

  it('signal: an already-aborted signal sends nothing', async () => {
    const counter = { calls: 0 };
    const client = new HttpClient({ retry: fast, fetchImpl: hanging(counter) });
    const reason = new Error('stop');
    await client.request('https://example.com/', {}, { signal: AbortSignal.abort(reason) })
      .then(() => { throw new Error('should fail'); }, (e) => expect(e).to.equal(reason));
    expect(counter.calls).to.equal(0);
  });

  it('signal: aborting while queued behind throttle stops right away and sends nothing', async () => {
    const seen = [];
    const client = new HttpClient({ retry: fast, fetchImpl: sequence([{}], seen) });
    await client.request('https://example.com/1', {}, { throttle: 0.5 }); // next slot is 2 s away
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const started = Date.now();
    await client.request('https://example.com/2', {}, { throttle: 0.5, signal: controller.signal })
      .then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('AbortError'));
    expect(Date.now() - started).to.be.below(1000);
    expect(seen.map((s) => s.url)).to.deep.equal(['https://example.com/1']);
  });

  it('signal: aborting during the retry wait stops right away', async () => {
    const seen = [];
    const client = new HttpClient({ retry: { retries: 3, minDelayMs: 5000, maxDelayMs: 5000 }, fetchImpl: sequence([{ status: 503 }], seen) });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const started = Date.now();
    await client.request('https://example.com/', {}, { signal: controller.signal })
      .then(() => { throw new Error('should fail'); }, (e) => expect(e.name).to.equal('AbortError'));
    expect(Date.now() - started).to.be.below(1000);
    expect(seen).to.have.length(1);
  });

  it('emits one usage event per attempt, in order', async () => {
    const events = [];
    setProxyUsageListener((e) => events.push(e));
    const client = new HttpClient({ retry: { retries: 3, minDelayMs: 1, maxDelayMs: 5 }, fetchImpl: sequence([{ status: 503 }, {}]) });
    await client.request('https://example.com/');
    expect(events).to.have.length(2);
    expect(events[0].error.statusCode).to.equal(503);
    expect(events[1].error).to.be.undefined;
  });

  it('lets requestOptions.headers override library headers, case-insensitively', async () => {
    const seen = [];
    const client = new HttpClient({ fetchImpl: sequence([{}], seen) });
    await client.request('https://example.com/', { 'Accept-Language': 'en-us', 'X-Apple-Store-Front': '143441' }, { headers: { 'accept-language': 'fr-fr' } });
    expect(seen[0].init.headers).to.deep.equal({ 'X-Apple-Store-Front': '143441', 'accept-language': 'fr-fr' });
  });
});

describe('HttpClient throttle', () => {
  it('spaces requests 1000/throttle ms apart, fractional rates included', async () => {
    const seen = [];
    const client = new HttpClient({ fetchImpl: sequence([{}], seen) });
    await Promise.all([1, 2, 3].map(() => client.request('https://example.com/', {}, { throttle: 2.5 })));
    expect(seen[1].at - seen[0].at).to.be.at.least(390);
    expect(seen[2].at - seen[0].at).to.be.at.least(790);
  });

  it('sends retries through the throttle too', async () => {
    const seen = [];
    const client = new HttpClient({ retry: { retries: 2, minDelayMs: 1, maxDelayMs: 5 }, fetchImpl: sequence([{ status: 503 }, {}], seen) });
    await client.request('https://example.com/', {}, { throttle: 5 });
    expect(seen[1].at - seen[0].at).to.be.at.least(190);
  });
});

describe('HttpClient retries', () => {
  it('retries network errors (fetch rejects with TypeError)', async () => {
    const client = new HttpClient({ retry: { retries: 3, minDelayMs: 1, maxDelayMs: 5 } });
    let calls = 0;
    client.setFetchImpl(async () => {
      calls += 1;
      if (calls < 3) throw new TypeError('fetch failed');
      return { ok: true, text: async () => 'ok' };
    });
    expect(await client.request('https://example.com/')).to.equal('ok');
    expect(calls).to.equal(3);
  });
});

describe('HttpClient env proxies', () => {
  const keys = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
  let saved;
  beforeEach(() => {
    saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    keys.forEach((k) => delete process.env[k]);
  });
  afterEach(() => keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

  it('honors lowercase https_proxy / http_proxy', () => {
    process.env.https_proxy = 'http://lower.local:3128';
    expect(new HttpClient().getProxyConfig().host).to.equal('lower.local');
    delete process.env.https_proxy;
    process.env.http_proxy = 'http://plain.local:8080';
    expect(new HttpClient().getProxyConfig().host).to.equal('plain.local');
  });

  it('prefers HTTPS_PROXY over lowercase variants', () => {
    process.env.HTTPS_PROXY = 'http://upper.local:3128';
    process.env.https_proxy = 'http://lower.local:3128';
    expect(new HttpClient().getProxyConfig().host).to.equal('upper.local');
  });
});

export interface ProxyOptions {
  url: string;
  rejectUnauthorized?: boolean;
}

type ProxyInput = ProxyOptions | string;

export interface ProxyUsageEvent {
  targetUrl: string;
  viaProxy: boolean;
  proxy?: {
    url: string;
    displayUrl: string;
    protocol: 'http' | 'https';
    host: string;
    port: string;
    rejectUnauthorized?: boolean;
    hasCredentials: boolean;
  };
  reason?: string;
  error?: unknown;
  country?: string;
}

type ProxyUsageListener = (event: ProxyUsageEvent) => void;

let proxyUsageListener: ProxyUsageListener | undefined;

type ProxyAgentFactoryResult = { dispatcher?: any; reason?: string; error?: unknown };
type ProxyAgentFactory = (
  config: NormalizedProxyConfig,
  options: Record<string, any>,
) => Promise<ProxyAgentFactoryResult> | ProxyAgentFactoryResult;

let proxyAgentFactory: ProxyAgentFactory | undefined;

export function setProxyUsageListener(listener?: ProxyUsageListener) {
  proxyUsageListener = listener;
}

export function __setProxyAgentFactoryForTests(factory?: ProxyAgentFactory) {
  proxyAgentFactory = factory;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  // custom timeout in ms
  timeoutMs?: number;
  proxy?: ProxyInput | false;
  rejectUnauthorized?: boolean;
  country?: string;
}

type FetchLike = typeof fetch;

class RateLimiter {
  private readonly requestsPerWindow: number;
  private readonly windowMs: number;
  private queue: Array<() => void> = [];
  private tokens: number;
  private lastRefill: number;

  constructor(requestsPerWindow = 0, windowMs = 1000) {
    this.requestsPerWindow = Math.max(0, requestsPerWindow);
    this.windowMs = windowMs;
    this.tokens = this.requestsPerWindow;
    this.lastRefill = Date.now();
    if (this.requestsPerWindow > 0) this.scheduleRefill();
  }

  private scheduleRefill() {
    setInterval(() => {
      this.tokens = this.requestsPerWindow;
      this.drain();
    }, this.windowMs).unref?.();
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      const fn = this.queue.shift()!;
      fn();
    }
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.requestsPerWindow <= 0) return fn();
    return new Promise<T>((resolve, reject) => {
      const task = () => fn().then(resolve, reject);
      this.queue.push(task);
      this.drain();
    });
  }
}

interface NormalizedProxyConfig {
  url: string;
  displayUrl: string;
  protocol: 'http' | 'https';
  host: string;
  port: string;
  hasCredentials: boolean;
  rejectUnauthorized?: boolean;
}

interface ProxyDispatcherResult {
  dispatcher?: any;
  error?: unknown;
  reason?: string;
}

function toDisplayUrl(parsed: URL, hasCredentials: boolean): string {
  const hostPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  if (!hasCredentials) return `${parsed.protocol}//${hostPort}`;
  return `${parsed.protocol}//***@${hostPort}`;
}

function normalizeProxy(value?: ProxyInput | false | null, fallbackReject?: boolean): NormalizedProxyConfig | undefined {
  if (value === undefined || value === null || value === false) return undefined;
  const proxy = typeof value === 'string' ? { url: value } : value;
  const rawUrl = proxy.url?.trim();
  if (!rawUrl) return undefined;
  const ensured = rawUrl.includes('://') ? rawUrl : `http://${rawUrl}`;
  let parsed: URL;
  try {
    parsed = new URL(ensured);
  } catch {
    return undefined;
  }
  const protocol = parsed.protocol.replace(':', '').toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') return undefined;
  const hasCredentials = parsed.username !== '' || parsed.password !== '';
  const port = parsed.port || (protocol === 'https' ? '443' : '80');
  const rejectUnauthorized = proxy.rejectUnauthorized ?? fallbackReject;
  return {
    url: ensured,
    displayUrl: toDisplayUrl(parsed, hasCredentials),
    protocol: protocol as 'http' | 'https',
    host: parsed.hostname,
    port,
    hasCredentials,
    rejectUnauthorized,
  };
}

function buildProxyKey(config: NormalizedProxyConfig): string {
  const reject = typeof config.rejectUnauthorized === 'undefined' ? 'default' : config.rejectUnauthorized ? 'true' : 'false';
  return `${config.url}|${reject}`;
}

async function createProxyDispatcher(config: NormalizedProxyConfig): Promise<ProxyDispatcherResult> {
  const options: any = { uri: config.url };
  if (typeof config.rejectUnauthorized !== 'undefined') {
    options.requestTls = { ...(options.requestTls || {}), rejectUnauthorized: config.rejectUnauthorized };
    if (config.protocol === 'https') {
      options.proxyTls = { ...(options.proxyTls || {}), rejectUnauthorized: config.rejectUnauthorized };
    }
  }
  try {
    if (proxyAgentFactory) {
      return await proxyAgentFactory(config, options);
    }
    const undici = await import('undici');
    const ProxyAgent = (undici as any).ProxyAgent;
    if (!ProxyAgent) {
      return { reason: 'ProxyAgent unavailable' };
    }
    return { dispatcher: new ProxyAgent(options) };
  } catch (error: any) {
    return { error, reason: error?.message };
  }
}

export interface RetryOptions {
  retries?: number; // total attempts including the first
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface ClientOptions {
  limiterRps?: number; // requests per second
  retry?: RetryOptions;
  fetchImpl?: FetchLike;
  proxyUrl?: string; // e.g., http://user:pass@host:port
  proxy?: ProxyInput | false;
  rejectUnauthorized?: boolean;
  countryProxies?: Record<string, ProxyInput | false | null | undefined>;
  countryProxyDefaultRejectUnauthorized?: boolean;
}

export class HttpClient {
  private limiter: RateLimiter;
  private retry: Required<RetryOptions>;
  private fetchImpl: FetchLike;
  private proxyConfig?: NormalizedProxyConfig;
  private proxyDispatchers: Map<string, any> = new Map();
  private countryProxyMap?: Map<string, NormalizedProxyConfig>;

  constructor(opts: ClientOptions = {}) {
    this.limiter = new RateLimiter(opts.limiterRps ?? 0, 1000);
    this.retry = {
      retries: opts.retry?.retries ?? 3,
      minDelayMs: opts.retry?.minDelayMs ?? 250,
      maxDelayMs: opts.retry?.maxDelayMs ?? 2500,
    };
    this.fetchImpl = opts.fetchImpl ?? fetch;
    if (opts.proxy === false) {
      this.proxyConfig = undefined;
    } else {
      const configured = normalizeProxy(opts.proxy ?? opts.proxyUrl, opts.rejectUnauthorized);
      if (configured) this.proxyConfig = configured;
      else {
        const envProxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
        this.proxyConfig = normalizeProxy(envProxy, opts.rejectUnauthorized);
      }
    }
    if (opts.countryProxies) {
      this.setCountryProxies(opts.countryProxies, opts.countryProxyDefaultRejectUnauthorized);
    }
  }

  private resolveProxyConfig(requestOptions: RequestOptions): NormalizedProxyConfig | undefined {
    if (requestOptions.proxy === false) return undefined;
    const override = normalizeProxy(requestOptions.proxy, requestOptions.rejectUnauthorized);
    if (override) return override;
    if (this.countryProxyMap && this.countryProxyMap.size > 0) {
      const country = typeof requestOptions.country === 'string' ? requestOptions.country.trim().toUpperCase() : undefined;
      if (country) {
        const entry = this.countryProxyMap.get(country);
        if (entry) {
          if (typeof requestOptions.rejectUnauthorized !== 'undefined') {
            return { ...entry, rejectUnauthorized: requestOptions.rejectUnauthorized };
          }
          return { ...entry };
        }
      }
      return undefined;
    }
    if (!this.proxyConfig) return undefined;
    if (typeof requestOptions.rejectUnauthorized !== 'undefined') {
      return { ...this.proxyConfig, rejectUnauthorized: requestOptions.rejectUnauthorized };
    }
    return { ...this.proxyConfig };
  }

  private async getProxyDispatcher(config: NormalizedProxyConfig): Promise<ProxyDispatcherResult & { config: NormalizedProxyConfig }> {
    const key = buildProxyKey(config);
    const cached = this.proxyDispatchers.get(key);
    if (cached) {
      return { dispatcher: cached, config };
    }
    const result = await createProxyDispatcher(config);
    if (result.dispatcher) {
      this.proxyDispatchers.set(key, result.dispatcher);
    } else {
      this.proxyDispatchers.delete(key);
    }
    return { ...result, config };
  }

  setFetchImpl(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  setProxy(proxy: ProxyInput | false | undefined, rejectUnauthorized?: boolean) {
    if (proxy === false) {
      this.proxyConfig = undefined;
      this.proxyDispatchers.clear();
      return;
    }
    if (typeof proxy === 'undefined') {
      const envProxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
      this.proxyConfig = normalizeProxy(envProxy, rejectUnauthorized);
    } else {
      this.proxyConfig = normalizeProxy(proxy, rejectUnauthorized) ?? undefined;
      if (!this.proxyConfig && typeof proxy === 'string' && proxy.trim() === '') {
        this.proxyConfig = undefined;
      }
      if (!this.proxyConfig && typeof proxy === 'object' && proxy?.url?.trim() === '') {
        this.proxyConfig = undefined;
      }
    }
    this.proxyDispatchers.clear();
  }

  setCountryProxies(
    proxies?: Record<string, ProxyInput | false | null | undefined>,
    defaultRejectUnauthorized?: boolean,
  ) {
    if (!proxies || Object.keys(proxies).length === 0) {
      this.countryProxyMap = undefined;
      this.proxyDispatchers.clear();
      return;
    }
    const map = new Map<string, NormalizedProxyConfig>();
    for (const [key, value] of Object.entries(proxies)) {
      if (!key) continue;
      if (value === false || value === null || typeof value === 'undefined') continue;
      const config = normalizeProxy(value, defaultRejectUnauthorized);
      if (!config) continue;
      map.set(key.trim().toUpperCase(), config);
    }
    this.countryProxyMap = map.size > 0 ? map : undefined;
    this.proxyDispatchers.clear();
  }

  getProxyConfig(): ProxyUsageEvent['proxy'] | undefined {
    if (!this.proxyConfig) return undefined;
    const { url, displayUrl, protocol, host, port, rejectUnauthorized, hasCredentials } = this.proxyConfig;
    return { url, displayUrl, protocol, host, port, rejectUnauthorized, hasCredentials };
  }

  getCountryProxyMap(): Record<string, ProxyUsageEvent['proxy']> {
    if (!this.countryProxyMap || this.countryProxyMap.size === 0) return {};
    const out: Record<string, ProxyUsageEvent['proxy']> = {};
    for (const [country, config] of this.countryProxyMap.entries()) {
      const { url, displayUrl, protocol, host, port, rejectUnauthorized, hasCredentials } = config;
      out[country] = { url, displayUrl, protocol, host, port, rejectUnauthorized, hasCredentials };
    }
    return out;
  }

  async request(url: string, headers: Record<string, string> = {}, requestOptions: RequestOptions = {}): Promise<string> {
    const method = requestOptions.method ?? 'GET';
    const mergedHeaders = { ...(requestOptions.headers || {}), ...headers };

    const attempt = async (attemptNo: number): Promise<string> => {
      const controller = new AbortController();
      const timeout = requestOptions.timeoutMs ? setTimeout(() => controller.abort(), requestOptions.timeoutMs) : undefined;

      const usageEvent: ProxyUsageEvent = {
        targetUrl: url,
        viaProxy: false,
        reason: 'direct',
        country: typeof requestOptions.country === 'string'
          ? requestOptions.country.trim().toUpperCase()
          : undefined,
      };

      try {
        let dispatcher: any = undefined;
        const proxyConfig = this.resolveProxyConfig(requestOptions);
        if (proxyConfig) {
          const result = await this.getProxyDispatcher(proxyConfig);
          usageEvent.proxy = {
            url: proxyConfig.url,
            displayUrl: proxyConfig.displayUrl,
            protocol: proxyConfig.protocol,
            host: proxyConfig.host,
            port: proxyConfig.port,
            rejectUnauthorized: proxyConfig.rejectUnauthorized,
            hasCredentials: proxyConfig.hasCredentials,
          };
          if (result.dispatcher) {
            dispatcher = result.dispatcher;
            usageEvent.viaProxy = true;
            usageEvent.reason = 'proxy';
          } else {
            usageEvent.reason = result.reason ?? 'proxy-unavailable';
            if (typeof result.error !== 'undefined') usageEvent.error = result.error;
          }
        } else if (requestOptions.proxy === false) {
          usageEvent.reason = 'proxy-disabled';
        }

        const res = await this.fetchImpl(url, {
          method,
          headers: mergedHeaders,
          body: requestOptions.body,
          signal: controller.signal,
          // @ts-ignore - dispatcher is undici-specific and allowed when using undici fetch
          dispatcher,
        } as RequestInit);

        // Non-2xx handling similar to reference (reject with response)
        if (!res.ok) {
          const headersObj: Record<string, string> = {};
          try {
            // Headers may not be iterable across environments; guard accordingly
            for (const [k, v] of (res.headers as any) || []) headersObj[k.toLowerCase?.() || k] = String(v);
          } catch {
            try {
              const h = (res.headers as any);
              if (h?.forEach) h.forEach((v: any, k: any) => (headersObj[String(k).toLowerCase()] = String(v)));
            } catch {}
          }
          const { HttpError } = await import('../errors');
          throw new HttpError(res.status, undefined, headersObj);
        }
        return await res.text();
      } catch (err: any) {
        if (typeof usageEvent.error === 'undefined') usageEvent.error = err;
        const status = err?.response?.statusCode ?? err?.statusCode;
        const isRetryable = status === 429 || (status >= 500 && status < 600) || err?.name === 'AbortError';
        if (attemptNo >= (this.retry.retries - 1) || !isRetryable) throw err;
        // Honor Retry-After header when present
        let retryAfterMs: number | undefined;
        const headers: Record<string, string> | undefined = err?.response?.headers;
        const ra = headers?.['retry-after'] || headers?.['Retry-After'];
        if (ra) {
          const secs = Number(ra);
          if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
          else {
            const until = Date.parse(ra);
            if (!Number.isNaN(until)) retryAfterMs = Math.max(0, until - Date.now());
          }
        }
        const jitter = Math.floor(Math.random() * 100);
        const expBackoff = this.retry.minDelayMs * Math.pow(2, attemptNo) + jitter;
        const backoff = Math.min(this.retry.maxDelayMs, retryAfterMs ?? expBackoff);
        await new Promise((r) => setTimeout(r, backoff));
        return attempt(attemptNo + 1);
      } finally {
        if (timeout) clearTimeout(timeout);
        proxyUsageListener?.({ ...usageEvent });
      }
    };

    return this.limiter.run(() => attempt(0));
  }
}

export const defaultClient = new HttpClient();

export function configureDefaultProxy(proxy: ProxyInput | false | undefined, rejectUnauthorized?: boolean) {
  defaultClient.setProxy(proxy, rejectUnauthorized);
}

export function getDefaultProxyConfig(): ProxyUsageEvent['proxy'] | undefined {
  return defaultClient.getProxyConfig();
}

export function configureCountryProxies(
  proxies?: Record<string, ProxyInput | false | null | undefined>,
  defaultRejectUnauthorized?: boolean,
) {
  defaultClient.setCountryProxies(proxies, defaultRejectUnauthorized);
}

export function getCountryProxyMap(): Record<string, ProxyUsageEvent['proxy']> {
  return defaultClient.getCountryProxyMap();
}

// Testing hook
export function __setFetchForTests(fetchImpl: FetchLike) {
  defaultClient.setFetchImpl(fetchImpl);
}

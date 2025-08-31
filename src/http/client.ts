export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  // custom timeout in ms
  timeoutMs?: number;
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
}

export class HttpClient {
  private limiter: RateLimiter;
  private retry: Required<RetryOptions>;
  private fetchImpl: FetchLike;
  private proxyUrl?: string;

  constructor(opts: ClientOptions = {}) {
    this.limiter = new RateLimiter(opts.limiterRps ?? 0, 1000);
    this.retry = {
      retries: opts.retry?.retries ?? 3,
      minDelayMs: opts.retry?.minDelayMs ?? 250,
      maxDelayMs: opts.retry?.maxDelayMs ?? 2500,
    };
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.proxyUrl = opts.proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  }

  setFetchImpl(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  async request(url: string, headers: Record<string, string> = {}, requestOptions: RequestOptions = {}): Promise<string> {
    const method = requestOptions.method ?? 'GET';
    const mergedHeaders = { ...(requestOptions.headers || {}), ...headers };

    const attempt = async (attemptNo: number): Promise<string> => {
      const controller = new AbortController();
      const timeout = requestOptions.timeoutMs ? setTimeout(() => controller.abort(), requestOptions.timeoutMs) : undefined;

      try {
        // Attach proxy dispatcher if configured and supported (undici)
        let dispatcher: any = undefined;
        if (this.proxyUrl) {
          try {
            const undici = await import('undici');
            const ProxyAgent = (undici as any).ProxyAgent;
            if (ProxyAgent) dispatcher = new ProxyAgent(this.proxyUrl);
          } catch {}
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
      }
    };

    return this.limiter.run(() => attempt(0));
  }
}

export const defaultClient = new HttpClient();

// Testing hook
export function __setFetchForTests(fetchImpl: FetchLike) {
  defaultClient.setFetchImpl(fetchImpl);
}

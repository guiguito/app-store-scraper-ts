const { __setFetchForTests } = require('../dist/cjs/http/client');

export function mockFetch(mapper: (url: string, init?: any) => { status?: number; ok?: boolean; body?: string }) {
  return async (url: any, init?: any) => {
    const res = mapper(String(url), init);
    const status = res.status ?? 200;
    const ok = res.ok ?? status >= 200 && status < 300;
    return {
      status,
      ok,
      text: async () => res.body ?? '',
    } as any;
  };
}

export function resetFetch() {
  __setFetchForTests(fetch as any);
}

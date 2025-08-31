const { __setFetchForTests } = require('../dist/cjs/http/client');

function mockFetch(mapper) {
  return async (url, init) => {
    const res = mapper(String(url), init);
    const status = res.status !== undefined ? res.status : 200;
    const ok = res.ok !== undefined ? res.ok : (status >= 200 && status < 300);
    return {
      status,
      ok,
      text: async () => res.body ?? '',
    };
  };
}

function resetFetch() {
  __setFetchForTests(fetch);
}

module.exports = { mockFetch, resetFetch };

# app-store-scraper-ts

TypeScript rewrite of the excellent App Store scraper. Ships strong types, robust HTTP with throttling + retries, and a memoized facade. Supports Node 18+ with dual ESM/CJS builds.

Reference: this project aims for API and field parity with the original JavaScript library: https://github.com/facundoolano/app-store-scraper

## Features
- Strongly typed API and payloads (TypeScript).
- Resilient HTTP client with throttling, exponential backoff, and Retry-After support.
- Memoized facade for easy in-memory caching (5 min TTL by default).
- Dual ESM/CJS output with first-class Node 18+ support.
- Opt-in integration tests; unit tests stub network by default.

## Install
- npm: `npm install app-store-scraper-ts`

## Quick Start
```ts
import {
  app, list, search, developer, suggest, similar,
  reviews, ratings, privacy, versionHistory, constants, memoized,
} from 'app-store-scraper-ts';

// Single app
const candy = await app({ id: '553834731', ratings: true });

// Lists
const topFree = await list({ collection: constants.collection.TOP_FREE_IOS, num: 10 });

// Search
const hits = await search({ term: 'panda', num: 5 });

// Developer
const metaApps = await developer({ devId: '284882218' });

// Suggest terms
const terms = await suggest({ term: 'pan' });

// Similar apps
const also = await similar({ id: '553834731' });

// Reviews and ratings
const revs = await reviews({ id: '553834731', page: 1, sort: constants.sort.RECENT });
const ratingSummary = await ratings({ id: '553834731', country: 'us' });

// Privacy & versions
const pd = await privacy({ id: '324684580' });
const vh = await versionHistory({ id: '324684580' });

// Memoized facade (caches results 5 minutes by default)
const store = memoized();
const cached = await store.app({ id: '553834731' });
```

## API Overview
- `app({ id?, appId?, country?, lang?, ratings?, requestOptions? })` → App
- `ratings({ id, country?, requestOptions? })` → `{ ratings, histogram }`
- `list({ collection, category?, country?, lang?, num?, fullDetail?, requestOptions? })` → AppLite[] | App[]
- `search({ term, num?, page?, country?, lang?, idsOnly?, requestOptions? })` → (App[] | string[])
- `developer({ devId, country?, lang?, requestOptions? })` → App[]
- `suggest({ term, country?, requestOptions? })` → `{ term }[]`
- `similar({ id?, appId?, country?, lang?, requestOptions? })` → App[]
- `reviews({ id, page?, sort?, country?, requestOptions? })` → Review[]
- `privacy({ id, country?, requestOptions? })` → PrivacyDetails
- `versionHistory({ id, country?, requestOptions? })` → VersionHistoryItem[]
- `memoized(opts?)` → same API with memoized methods

Common options
- `country`: ISO country code (default: `us`).
- `lang`: IETF language tag where supported (e.g., `en-us`).
- `requestOptions`: per-call HTTP overrides (`{ method, headers, body, timeoutMs }`).

### Examples
App by id with ratings
```ts
const appWithRatings = await app({ id: '553834731', ratings: true });
console.log(appWithRatings.ratings, appWithRatings.histogram);
```

Top free list (summary items)
```ts
const top = await list({ collection: constants.collection.TOP_FREE_IOS, num: 5 });
```

Search with pagination
```ts
const page1 = await search({ term: 'panda', num: 10, page: 1 });
const page2 = await search({ term: 'panda', num: 10, page: 2 });
```

Developer apps
```ts
const apps = await developer({ devId: '284882218' });
```

Suggestions
```ts
const suggestions = await suggest({ term: 'pan' });
```

Similar apps to one app
```ts
const also = await similar({ id: '553834731' });
```

Reviews and ratings
```ts
const revs = await reviews({ id: '553834731', page: 1, sort: constants.sort.RECENT });
const ratingSummary = await ratings({ id: '553834731', country: 'us' });
```

Privacy details and version history
```ts
const pd = await privacy({ id: '324684580' });
const vh = await versionHistory({ id: '324684580' });
```

Memoized facade
```ts
const store = memoized({ maxAge: 5 * 60 * 1000, max: 1000 });
const cached = await store.app({ id: '553834731' });
```

## HTTP, Throttling, Retry
- All methods use a shared HTTP client with a rate limiter and exponential backoff with jitter.
- `Retry-After` headers on 429/5xx are honored when present.
- Per-call `requestOptions` allow overriding `method`, `headers`, `body`, and `timeoutMs`.
- Set `HTTP_PROXY` / `HTTPS_PROXY` to route through a proxy (Node 18 `fetch` + undici ProxyAgent).

## Errors
- `ValidationError`: input validation issues (e.g., missing `id`).
- `NotFoundError`: app not found / empty results where applicable.
- `HttpError`: non-2xx responses with `statusCode` and `response.headers` when available.

## ESM/CJS
- ESM: `import { app } from 'app-store-scraper-ts'` (uses `dist/esm`).
- CJS: `const store = require('app-store-scraper-ts')` (uses `dist/cjs`).

## Types
- All payloads are typed (`App`, `AppLite`, `Review`, `Ratings`, `PrivacyDetails`, `VersionHistoryItem`).
- Constants expose `collection`, `category`, `sort` and related union types.

## Testing
- Unit tests stub network; run with `npm test`.
- Integration tests (optional): `INTEGRATION=1 npm test`.
- Coverage: `npm run test:coverage` (nyc over compiled JS).

## Reference & Credits
- Upstream reference implementation: https://github.com/facundoolano/app-store-scraper
- This project closely follows its contract and behavior while providing a typed, modern TS implementation. The `reference/` folder is included for parity checks and is excluded from publishing.

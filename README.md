# app-store-scraper-ts

TypeScript rewrite of the excellent App Store scraper. Ships strong types, resilient HTTP (retry + backoff), and a memoized facade. Supports Node 18+ with dual ESM/CJS builds.

Reference: API/field parity with the original library where possible: https://github.com/facundoolano/app-store-scraper

## Features
- Strongly typed API and payloads (TypeScript).
- HTTP client with exponential backoff, Retry-After support, and rate limiting.
- HTTP and HTTPS proxy support via env vars or runtime configuration, plus TLS opt-out hooks.
- Memoized facade to cache results in memory.
- Dual ESM/CJS output; Node 18+ fetch-based.
- Unit tests with Nock-style stubs; optional integration tests.

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

## Proxy configuration
- Requests go direct unless you opt in. Provide a per-country map via `configureCountryProxies({ US: 'https://...', FR: { url, rejectUnauthorized } })`. Country keys are case-insensitive; missing entries (or missing `country` params) fall back to a direct connection.
- For a single global proxy call `configureDefaultProxy('https://proxy:8443')`. Calling `configureDefaultProxy(false)` or `configureCountryProxies()` resets everything to direct.
- Pass `false` as `rejectUnauthorized` to tolerate self-signed certificates. This works for both country maps and one-off overrides.
- Use `setProxyUsageListener` to log `proxy[...]` vs `direct` decisions—for example, the UI harness pipes these messages to the console.
- You can still override proxies per request with `requestOptions.proxy` / `requestOptions.rejectUnauthorized` when you need a temporary exit that differs from the configured map.

```ts
import {
  app,
  configureCountryProxies,
  configureDefaultProxy,
  memoized,
  setProxyUsageListener,
} from 'app-store-scraper-ts';

// Country map: US uses corp proxy, FR tunnels through a staging proxy that allows invalid certs.
configureCountryProxies({
  US: 'https://us-proxy.example:8443',
  FR: { url: 'https://fr-proxy-staging.local:4443', rejectUnauthorized: false },
});

// Reset the map and fall back to a single proxy (optional)
configureCountryProxies();
configureDefaultProxy('https://fallback-proxy.example:8080');

// Observe routing decisions: proxy[...] vs direct
setProxyUsageListener((event) => {
  const label = event.viaProxy ? `proxy[${event.country ?? '??'}:${event.proxy?.displayUrl}]` : `direct[${event.country ?? '??'}]`;
  const insecure = event.proxy?.rejectUnauthorized === false ? ' ⚠ insecure TLS' : '';
  console.log(`${label}${insecure} -> ${event.targetUrl}`);
});

// Requests automatically pick the proxy that matches the country parameter.
await app({ id: '553834731', country: 'fr' }); // → goes through fr-proxy-staging.local
await app({ id: '553834731', country: 'jp' }); // → direct (no JP proxy configured)

// Per-request overrides still win when you need a temporary exit
const store = memoized();
await store.app({ id: '553834731', country: 'us', requestOptions: { proxy: 'http://temporary-proxy:3128' } });
```

Manual verification tip: run `npm run ui`, assign proxies to a couple of countries in the control panel, and call a geo-sensitive endpoint (e.g., `https://ifconfig.me`) through each storefront. Check the server console for `proxy[COUNTRY:…]` vs `direct` lines and confirm the reported IP/country changes accordingly.

## API Overview
- `app(options)` → `App`
- `ratings(options)` → `{ ratings, histogram }`
- `list(options)` → `AppLite[]` (or `App[]` with `fullDetail: true`)
- `search(options)` → `App[]` (or `string[]` when `idsOnly: true`)
- `developer(options)` → `App[]`
- `suggest(options)` → `{ term }[]`
- `similar(options)` → `App[]`
- `reviews(options)` → `Review[]`
- `privacy(options)` → `PrivacyDetails`
- `versionHistory(options)` → `VersionHistoryItem[]`
- `memoized(opts?)` → same API with memoized methods

Common options (where supported)
- `country` (string): ISO country code. Default: `us` (or `US` where Apple requires upper-case).
- `lang` (string): IETF language tag (e.g., `en-us`). Default depends on endpoint.
- `requestOptions` (object): per-call HTTP overrides `{ method, headers, body, timeoutMs }`.
- `throttle` (number): requests per second. Currently forwarded internally but not applied per-call yet.

---

## Methods

### app
Fetch app details by App Store numeric `id` or bundle identifier `appId`.

Signature
```ts
app({ id?, appId?, country?, lang?, ratings?, requestOptions?, throttle? }): Promise<App>
```

Parameters
- `id` (string|number): Numeric App Store id, e.g., `553834731`.
- `appId` (string): Bundle id, e.g., `com.midasplayer.apps.candycrushsaga`.
- `country` (string): Country storefront (default `us`).
- `lang` (string): Language/locale passed to Apple lookup (optional).
- `ratings` (boolean): When true, merges `ratings()` totals and `histogram` into result.
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): Reserved.

Returns
- `App`: Full app document, fields detailed in Types below. When `ratings: true`, the object also includes `ratings` and `histogram`.

Errors
- Throws `ValidationError` when neither `id` nor `appId` is provided.
- Throws `NotFoundError` when the app cannot be found.

Examples
```ts
await app({ id: '553834731' });
await app({ appId: 'com.midasplayer.apps.candycrushsaga', ratings: true });
```

### ratings
Fetch the total ratings count and star histogram.

Signature
```ts
ratings({ id, country?, requestOptions? }): Promise<{ ratings: number; histogram: Record<string, number> }>
```

Parameters
- `id` (string|number): Numeric App Store id (required).
- `country` (string): Country storefront (default `us`).
- `requestOptions` (object): HTTP overrides.

Returns
- Object with:
  - `ratings` (number): Total ratings count.
  - `histogram` (object): Keys `'5'..'1'` mapping to counts.

Errors
- Throws `ValidationError` when `id` is missing.
- Throws `NotFoundError` when the app page cannot be fetched.

### list
Fetch ranked lists (top free, top paid, etc.).

Signature
```ts
list({ collection, category?, country?, lang?, num?, fullDetail?, requestOptions?, throttle? }): Promise<AppLite[] | App[]>
```

Parameters
- `collection` (constants.collection): Required. e.g., `TOP_FREE_IOS`, `TOP_PAID_IOS`, `TOP_FREE_IPAD`, etc.
- `category` (constants.category): Optional category filter (e.g., `GAMES`, `BUSINESS`, `GAMES_ACTION`).
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to lookup when `fullDetail`.
- `num` (number): Number of items (default 50, max 200).
- `fullDetail` (boolean): When true, resolves summary entries via lookup to return full `App` objects.
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): Reserved.

Returns
- `AppLite[]` by default (summary entries from RSS) or `App[]` when `fullDetail: true`.

Errors
- `ValidationError` on invalid `collection` or `category`, or when `num > 200`.

### search
Search for apps by term.

Signature
```ts
search({ term, num?, page?, country?, lang?, idsOnly?, requestOptions?, throttle? }): Promise<App[] | string[]>
```

Parameters
- `term` (string): Search query (required).
- `num` (number): Page size window (default 50).
- `page` (number): 1-based page index (default 1).
- `country` (string): Country storefront (default `us`).
- `lang` (string): Accept-Language header (default `en-us`).
- `idsOnly` (boolean): When true, returns only the app ids (`string[]`).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): Reserved.

Returns
- `App[]` or `string[]` when `idsOnly` is true.

Errors
- `ValidationError` when `term` is missing.

### developer
List all apps by a developer id.

Signature
```ts
developer({ devId, country?, lang?, requestOptions?, throttle? }): Promise<App[]>
```

Parameters
- `devId` (string|number): Apple developer id (required).
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to Apple lookup.
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): Reserved.

Returns
- `App[]` belonging to the developer.

Errors
- `ValidationError` when `devId` is missing.
- `Error('Developer not found (404)')` when empty.

### suggest
Get search suggestions for a partial term.

Signature
```ts
suggest({ term, country?, requestOptions? }): Promise<Array<{ term: string }>>
```

Parameters
- `term` (string): Partial query (required).
- `country` (string): Country storefront (default `us`).
- `requestOptions` (object): HTTP overrides.

Returns
- Array of `{ term: string }` suggestions ordered by Apple.

Errors
- `ValidationError` when `term` is missing.

### similar
Fetch apps similar to a given app ("Customers Also Bought").

Signature
```ts
similar({ id?, appId?, country?, lang?, requestOptions?, throttle? }): Promise<App[]>
```

Parameters
- `id` (string|number): Numeric app id.
- `appId` (string): Bundle id; if provided, resolved to `id` first.
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to lookup.
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): Reserved.

Returns
- `App[]` similar to the requested app (may be empty when Apple does not provide the section).

Errors
- `ValidationError` when neither `id` nor `appId` is provided.

### reviews
Fetch paged customer reviews for an app.

Signature
```ts
reviews({ id, appId?, sort?, page?, country?, requestOptions? }): Promise<Review[]>
```

Parameters
- `id` (string|number): Numeric app id. (`appId` is accepted by type but currently not used.)
- `sort` (constants.sort): `RECENT` or `HELPFUL` (default `RECENT`).
- `page` (number): 1..10 (Apple limits to 10 pages). Default `1`.
- `country` (string): Default `us`.
- `requestOptions` (object): HTTP overrides.

Returns
- `Review[]` with fields listed in Types below.

Errors
- `ValidationError` on missing id/appId.
- `ValidationError` on invalid `sort`, `page < 1`, or `page > 10`.

### privacy
Fetch App Privacy details (Data Used to Track You, etc.).

Signature
```ts
privacy({ id, country?, requestOptions? }): Promise<PrivacyDetails>
```

Parameters
- `id` (string|number): Numeric app id (required).
- `country` (string): Default `US` (upper-case as required by Apple’s AMP API).
- `requestOptions` (object): HTTP overrides.

Returns
- `PrivacyDetails` structured similarly to Apple’s App Privacy sections.

Errors
- `ValidationError` when `id` is missing.
- `NotFoundError` when app or token cannot be fetched.

### versionHistory
Fetch version history (iOS platform attributes) for an app.

Signature
```ts
versionHistory({ id, country?, requestOptions? }): Promise<VersionHistoryItem[]>
```

Parameters
- `id` (string|number): Numeric app id (required).
- `country` (string): Default `US` (upper-case).
- `requestOptions` (object): HTTP overrides.

Returns
- `VersionHistoryItem[]` for iOS containing `versionDisplay`, `releaseNotes`, `releaseDate`, `releaseTimestamp`.

Errors
- `ValidationError` when `id` is missing.
- `NotFoundError` when app or token cannot be fetched.

### memoized
Wraps the full API with a simple in-memory cache.

Signature
```ts
memoized(opts?: { maxAge?: number; max?: number })
```

Parameters
- `maxAge` (number): TTL in ms for cached entries (default 5 minutes).
- `max` (number): Max cached keys (default 1000; FIFO eviction).

Returns
- Object exposing the same methods as the main module, but memoized per-argument list.

---

## Types (Returned Objects)

These are the main types returned by the library. Field presence may vary slightly per endpoint/availability.

### AppLite
Summary entry returned by `list()` when `fullDetail` is not set.

```ts
interface AppLite {
  id: string | number;               // numeric app id
  appId: string;                     // bundle id
  title: string;                     // app name
  url: string;                       // App Store URL
  icon?: string;                     // artwork (largest available)
  price: number | string;            // numeric when parsable
  currency?: string;                 // e.g., 'USD'
  free: boolean;                     // price === 0
  description?: string;              // summary from RSS
  developer: string;                 // developer name
  developerUrl?: string;             // developer App Store URL
  developerId?: string | number;     // numeric id parsed from URL when present
  genre?: string;                    // primary genre label
  genreId?: string | number;         // primary genre id
  released?: string;                 // ISO date
}
```

### App
Full app object returned by `app()`, `search()`, `developer()`, `similar()`, and `list({ fullDetail: true })`.

```ts
interface App extends AppLite {
  genres?: string[];                 // all genres
  genreIds?: string[];               // all genre ids
  primaryGenre?: string;             // primary genre label
  primaryGenreId?: number;           // primary genre id
  contentRating?: string;            // e.g., '4+'
  languages?: string[];              // ISO2 codes
  size?: string;                     // bytes (string as Apple returns)
  requiredOsVersion?: string;        // minimum iOS version
  updated?: string;                  // ISO date for current version
  releaseNotes?: string;             // current version notes
  version?: string;                  // semantic version string
  score?: number;                    // average user rating (0..5)
  reviews?: number;                  // total ratings count
  currentVersionScore?: number;      // rating for current version
  currentVersionReviews?: number;    // ratings count for current version
  screenshots?: string[];            // iPhone screenshots
  ipadScreenshots?: string[];        // iPad screenshots
  appletvScreenshots?: string[];     // Apple TV screenshots
  supportedDevices?: string[];       // device identifiers
  // When app({ ratings: true }) is used:
  ratings?: number;                  // total ratings (parsed from web page)
  histogram?: Record<string, number>;// star histogram { '5': n, ..., '1': n }
}
```

### Review
Returned by `reviews()`.

```ts
interface Review {
  id: string;                        // review id
  userName: string;                  // author name
  userUrl: string;                   // author profile URL
  version: string;                   // app version reviewed
  score: number;                     // 1..5
  title: string;                     // review title
  text: string;                      // review body
  url: string;                       // review URL
  updated: string;                   // ISO date
}
```

### Ratings
Returned by `ratings()`.

```ts
interface Ratings {
  ratings: number;                   // total ratings
  histogram: Record<string, number>; // { '5': n, '4': n, '3': n, '2': n, '1': n }
}
```

### PrivacyDetails
Returned by `privacy()`.

```ts
interface PrivacyDetails {
  managePrivacyChoicesUrl: string | null;
  privacyTypes: Array<{
    privacyType: string;             // section title, e.g., 'Data Used to Track You'
    identifier: string;              // enum identifier
    description: string;             // section description
    dataCategories: Array<{
      dataCategory: string;          // category name
      identifier: string;            // category identifier
      dataTypes: string[];           // data types within the category
    }>;
    purposes: string[];              // purposes listed by Apple
  }>;
}
```

### VersionHistoryItem
Returned by `versionHistory()`.

```ts
interface VersionHistoryItem {
  versionDisplay: string;            // e.g., '1.0.0'
  releaseNotes: string;              // notes text
  releaseDate: string;               // 'YYYY-MM-DD'
  releaseTimestamp: string;          // ISO timestamp
}
```

---

## Constants

`constants` exports enums mirroring Apple values and common filters:

- `collection`: `TOP_FREE_IOS`, `TOP_PAID_IOS`, `TOP_GROSSING_IOS`, `TOP_FREE_IPAD`, `TOP_PAID_IPAD`, `NEW_IOS`, `NEW_FREE_IOS`, `NEW_PAID_IOS`, plus macOS variants (`TOP_MAC`, `TOP_FREE_MAC`, `TOP_PAID_MAC`, `TOP_GROSSING_MAC`).
- `category`: top-level and nested categories (e.g., `GAMES`, `BUSINESS`, `GAMES_ACTION`, ...). See `src/constants.ts` for the complete list.
- `sort`: `RECENT`, `HELPFUL` (for reviews).

---

## HTTP, Retry, Proxy
- Exponential backoff with jitter and `Retry-After` support on 429/5xx.
- Per-call `requestOptions` allow overriding `method`, `headers`, `body`, `timeoutMs`.
- Proxy support via `HTTPS_PROXY`/`HTTP_PROXY` (undici `ProxyAgent` when available).
- A rate limiter exists in the HTTP client; per-call `throttle` is currently reserved.

---

## Errors
- `ValidationError`: input validation issues (e.g., missing `id`, invalid `collection`).
- `NotFoundError`: app not found / empty results for certain endpoints.
- `HttpError`: non-2xx responses, includes `statusCode` and headers when available.

---

## ESM/CJS
- ESM: `import { app } from 'app-store-scraper-ts'` (uses `dist/esm`).
- CJS: `const store = require('app-store-scraper-ts')` (uses `dist/cjs`).

---

## Testing
- Unit tests stub network; run `npm test`.
- Integration tests: `INTEGRATION=1 npm test`.
- Coverage: `npm run test:coverage`.

---

## Reference & Credits
- Upstream: https://github.com/facundoolano/app-store-scraper
- This project follows the reference contract closely while providing a modern TS implementation.

# app-store-scraper-ts

TypeScript rewrite of the excellent App Store scraper. Ships strong types, resilient HTTP (retry + backoff), and a memoized facade. Supports Node 20.18+; ships a CommonJS build that ESM code can import directly.

Reference: API/field parity with the original library where possible: https://github.com/facundoolano/app-store-scraper

## Features
- Strongly typed API and payloads (TypeScript).
- HTTP client with exponential backoff, Retry-After support, and rate limiting.
- HTTP and HTTPS proxy support via env vars or runtime configuration, plus TLS opt-out hooks.
- Memoized facade to cache results in memory.
- Optional real App Store subtitles (`subtitle: true`), which Apple's lookup API doesn't return.
- In-app purchases with numeric prices, currency and subscription periods (`inAppPurchases()`).
- Cancellable calls via a standard `AbortSignal` (`requestOptions.signal`).
- Top charts to rank 200 for iPhone top free and top paid (`list({ num: 200 })`), past the RSS feed's cap of 100.
- CommonJS output usable from both `require` and `import`; Node 20.18+ fetch-based.
- Unit tests against a stubbed `fetch` (no network); optional live integration tests.

## Install
- npm: `npm install app-store-scraper-ts`

## Quick Start
```ts
import {
  app, list, search, developer, suggest, similar,
  reviews, ratings, privacy, versionHistory, inAppPurchases, constants, memoized,
} from 'app-store-scraper-ts';

// Single app
const candy = await app({ id: '553834731', ratings: true });
const withSubtitle = await app({ id: '553834731', subtitle: true }); // withSubtitle.subtitle

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

// In-app purchases (top 10, priced in the storefront's currency)
const iaps = await inAppPurchases({ id: '570060128', country: 'fr' }); // [{ title: 'Super Duolingo', price: 9.99, currency: 'EUR', ... }]

// Memoized facade (caches results 5 minutes by default)
const store = memoized();
const cached = await store.app({ id: '553834731' });
```

## Proxy configuration
- Requests go direct unless you opt in. Provide a per-country map via `configureCountryProxies({ US: 'https://...', FR: { url, rejectUnauthorized } })`. Country keys are case-insensitive. Calls without a `country` use the `us` storefront, so they go through the `US` entry; countries with no entry go direct.
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

## UI test harness
- Launch with `npm run ui` (builds the CJS bundle and starts a lightweight server on `http://localhost:3000`).
- The top form exercises every endpoint; enter params, hit **Run**, and compare the “Nice View” and “Raw JSON” panes.
- The proxy panel lets you add per-country proxy rows (HTTPS supported, credentials masked, optional “Allow invalid certs”). Unmatched countries fall back to direct routing.
- Server logs show routing decisions via the runtime `setProxyUsageListener` hook, e.g., `proxy[FR:https://…]` vs `direct[JP]`.
- Useful for manual QA: map `fr` to a proxy, call an IP-check endpoint through the France storefront, and confirm both the log output and the geo/IP change.

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
- `inAppPurchases(options)` → `InAppPurchase[]`
- `memoized(opts?)` → same API with memoized methods

Common options (where supported)
- `country` (string): ISO country code. Default: `us`.
- `lang` (string): IETF language tag (e.g., `en-us`). Default depends on endpoint.
- `requestOptions` (`RequestOptions`): per-call HTTP overrides `{ method, headers, body, timeoutMs, proxy, rejectUnauthorized, signal }`. Your headers override the ones the library sets (`X-Apple-Store-Front`, `Accept-Language`), matched case-insensitively.
- `throttle` (number): max requests per second for the HTTP requests this call makes, retries included. Requests are spaced evenly (`1000 / throttle` ms apart, so `0.5` means one every 2 s); calls passing the same value share one budget.
- `subtitle` (boolean): on `app`, `search`, `developer`, `similar` and `list({ fullDetail: true })`. See below.

### Cancelling a call

Every method accepts a standard `AbortSignal` in `requestOptions.signal`. Aborting it stops the call right away:

- the request in progress is aborted, and a request still queued behind `throttle` is never sent;
- no retry is attempted, and a pending retry wait ends immediately;
- the promise rejects with the signal's reason, which is a `DOMException` named `AbortError` unless you passed your own reason to `abort()`.

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000); // give up after 5 s overall, retries included
try {
  await search({ term: 'chess', requestOptions: { signal: controller.signal } });
} catch (err) {
  if ((err as Error).name === 'AbortError') { /* cancelled */ }
}
// Shortcut for a deadline: requestOptions: { signal: AbortSignal.timeout(5000) } (rejects with a TimeoutError).
```

`timeoutMs` is different: it limits each attempt, and a timed-out attempt is retried. `signal` covers the whole call and is never retried.

### App subtitles

The subtitle is the short tagline under the app name on the App Store (30 characters max), e.g. Duolingo's "Spanish, French, Chess & Math".

**It is not returned by default.** Apple's lookup API, which every method returning `App` uses, has no subtitle field (the original app-store-scraper doesn't return one either). Pass `subtitle: true` to get it:

```ts
const duolingo = await app({ id: 570060128, subtitle: true });
duolingo.subtitle; // 'Spanish, French, Chess & Math'

const results = await search({ term: 'language', num: 20, subtitle: true }); // 20 subtitles, 1 extra request
```

What to know:
- **Do not use the first line of `description` as a subtitle.** It's a different text, usually a long sentence.
- **Cost:** one extra request to Apple's catalog API (`apps.apple.com/api/apps/v1/catalog`) per 99 apps returned. `app()` and `search({ num: 50 })` each make 1 more request; `list({ num: 100, fullDetail: true })` makes 2 more (99 + 1). That's why it's opt-in: more requests means more chance of Apple rate-limiting you (HTTP 403/429).
- **Country-specific:** the subtitle comes from the `country` storefront, in that storefront's language (Duolingo in `fr` is "Anglais, échecs et plus"). `lang` does not change it.
- **May be missing:** `subtitle` stays `undefined` when the app has none, or when the catalog request fails. A failed subtitle request never fails the call; you still get the apps.
- **Platform:** the iOS subtitle, or the Mac one for Mac-only apps.
- Not available on `list()` without `fullDetail` (RSS entries aren't looked up), nor on `AppLite`.

---

## Methods

### app
Fetch app details by App Store numeric `id` or bundle identifier `appId`.

Signature
```ts
app({ id?, appId?, country?, lang?, ratings?, subtitle?, inAppPurchases?, requestOptions?, throttle? }): Promise<App>
```

Parameters
- `id` (string|number): Numeric App Store id, e.g., `553834731`.
- `appId` (string): Bundle id, e.g., `com.midasplayer.apps.candycrushsaga`.
- `country` (string): Country storefront (default `us`).
- `lang` (string): Language/locale passed to Apple lookup (optional).
- `ratings` (boolean): When true, merges `ratings()` totals and `histogram` into result.
- `inAppPurchases` (boolean): When true, adds `inAppPurchases` (same data as the [`inAppPurchases()`](#inapppurchases) method). One extra request; unlike `subtitle`, the call throws if it fails, like `ratings`.
- `subtitle` (boolean): Also fetch each app's App Store subtitle into `subtitle` (default `false`; one extra request per 99 apps). See [App subtitles](#app-subtitles).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): max requests per second (see Common Options).

Returns
- `App`: Full app document, fields detailed in Types below. When lookup returns no iPhone screenshots, missing screenshot lists are filled from Apple's catalog API (one extra request, highest resolution per device). When `ratings: true`, the object also includes `ratings` and `histogram`.

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
- Throws `NotFoundError` when the app does not exist.

### list
Fetch ranked lists (top free, top paid, etc.).

Signature
```ts
list({ collection, category?, country?, lang?, num?, fullDetail?, subtitle?, requestOptions?, throttle? }): Promise<AppLite[] | App[]>
```

Parameters
- `collection` (constants.collection): Required. e.g., `TOP_FREE_IOS`, `TOP_PAID_IOS`, `TOP_FREE_IPAD`, etc.
- `category` (constants.category): Optional category filter (e.g., `GAMES`, `BUSINESS`, `GAMES_ACTION`).
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to lookup when `fullDetail`.
- `num` (number): Number of apps (default 50, max 200). Apple's RSS feed stops at 100. Above 100, iPhone top free and top paid charts also get ranks 101–200 from the App Store website; everything else stays at 100. See [Ranks past 100](#ranks-past-100) below.
- `fullDetail` (boolean): When true, resolves summary entries via lookup to return full `App` objects.
- `subtitle` (boolean): Also fetch each app's App Store subtitle into `subtitle` (only with `fullDetail: true`; default `false`; one extra request per 99 apps). See [App subtitles](#app-subtitles).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): max requests per second (see Common Options).

Returns
- `AppLite[]` by default (summary entries from RSS) or `App[]` when `fullDetail: true`.

Errors
- `ValidationError` on invalid `collection` or `category`, or when `num > 200`.

#### Ranks past 100

Apple's RSS feed, which `list()` reads, returns at most 100 apps whatever `num` asks for. The App Store website's chart page (`https://apps.apple.com/{country}/iphone/charts/{genreId}`) ranks 200, so with `num` above 100 `list()` reads both:

```js
const finance = await list({ collection: constants.collection.TOP_FREE_IOS, category: constants.category.FINANCE, country: 'fr', num: 200 });
finance.length; // 200: ranks 1–100 from RSS, 101–200 from the chart page
```

- **Which charts:** `TOP_FREE_IOS` with any `category`, or none (the "All Apps" chart), and `TOP_PAID_IOS` with a `category`. Everything else stays at 100: top grossing, new, iPad and Mac collections, and `TOP_PAID_IOS` without a category (RSS mixes games into that chart and the website doesn't).
- **Ranks 1–100 are always RSS's.** The page's ranks are used only if the page lists RSS's apps in the same order. Otherwise you get RSS's 100 and no error.
- **Fails safely:** if the page can't be fetched, has changed shape, or disagrees with RSS, `list()` returns RSS's 100 apps without throwing. Cancelling with `requestOptions.signal` still rejects.
- **Cost:** the page and RSS are fetched in parallel (the page is about 550 KB). Without `fullDetail`, one more `lookup` request fills in ranks 101–200; with `fullDetail`, a single `lookup` covers all 200.
- **Ranks 101–200 come from `lookup`:** `icon` is the 512 px artwork (RSS gives 100 px), `description` is the full text, and `genre` is the primary genre. Ids are strings, like the RSS entries'.
- **App bundles are skipped,** as in RSS, so a paid chart can return a few fewer than 200 apps.
- **Paid charts:** the website still ranks some apps that recently went free, which RSS leaves out. Within ranks 1–100 those are skipped so the RSS ranks stay intact; past 100 they're kept, as on the App Store.
- **Freshness:** Apple's CDN caches the page for up to 15 minutes.
- **Risk:** this is a web page, not an API, and Apple can change it without notice. If it does, you get 100 apps again rather than errors. The weekly live test (`tests/integration/live.spec.js`) checks it.

Checked on November 4, 2026, against RSS:
- **Free charts:** every non-empty iPhone chart (all 70 categories in the US, Finance and "All Apps" in 10 other storefronts including JP, KR, CN, SA and RU) matched RSS position by position for the whole top 100.
- **Paid charts with a category:** each matched once app bundles and the recently-free apps above were set aside.
- **Ranks 101–200:** no duplicates, and `lookup` resolved every id.

### search
Search for apps by term.

Signature
```ts
search({ term, num?, page?, country?, lang?, idsOnly?, subtitle?, requestOptions?, throttle? }): Promise<App[] | string[]>
```

Parameters
- `term` (string): Search query (required).
- `num` (number): Page size window (default 50).
- `page` (number): 1-based page index (default 1).
- `country` (string): Country storefront (default `us`).
- `lang` (string): Accept-Language header (default `en-us`).
- `idsOnly` (boolean): When true, returns only the app ids (`string[]`).
- `subtitle` (boolean): Also fetch each app's App Store subtitle into `subtitle` (default `false`; one extra request per 99 apps). See [App subtitles](#app-subtitles).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): max requests per second (see Common Options).

Returns
- `App[]` or `string[]` when `idsOnly` is true.

Errors
- `ValidationError` when `term` is missing.

### developer
List all apps by a developer id.

Signature
```ts
developer({ devId, country?, lang?, subtitle?, requestOptions?, throttle? }): Promise<App[]>
```

Parameters
- `devId` (string|number): Apple developer id (required).
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to Apple lookup.
- `subtitle` (boolean): Also fetch each app's App Store subtitle into `subtitle` (default `false`; one extra request per 99 apps). See [App subtitles](#app-subtitles).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): max requests per second (see Common Options).

Returns
- `App[]` belonging to the developer.

Errors
- `ValidationError` when `devId` is missing.
- `NotFoundError('Developer not found (404)')` when the developer has no apps or does not exist.

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
similar({ id?, appId?, country?, lang?, subtitle?, requestOptions?, throttle? }): Promise<App[]>
```

Parameters
- `id` (string|number): Numeric app id.
- `appId` (string): Bundle id; if provided, resolved to `id` first.
- `country` (string): Default `us`.
- `lang` (string): Optional, forwarded to lookup.
- `subtitle` (boolean): Also fetch each app's App Store subtitle into `subtitle` (default `false`; one extra request per 99 apps). See [App subtitles](#app-subtitles).
- `requestOptions` (object): HTTP overrides.
- `throttle` (number): max requests per second (see Common Options).

Returns
- `App[]` similar to the requested app (may be empty when Apple does not provide the section).

Errors
- `ValidationError` when neither `id` nor `appId` is provided.

### reviews
Fetch paged customer reviews for an app.

Signature
```ts
reviews({ id?, appId?, sort?, page?, country?, requestOptions? }): Promise<Review[]>
```

Parameters
- `id` (string|number): Numeric app id.
- `appId` (string): Bundle id; resolved to `id` with one extra lookup request.
- `sort` (constants.sort): `RECENT` or `HELPFUL` (default `RECENT`).
- `page` (number): 1..10 (Apple limits to 10 pages). Default `1`.
- `country` (string): Default `us`.
- `requestOptions` (object): HTTP overrides.

Returns
- `Review[]` with fields listed in Types below.

Errors
- `ValidationError` on missing id/appId.
- `NotFoundError` when `appId` does not resolve to an app.
- `ValidationError` on invalid `sort`, `page < 1`, or `page > 10`.

### privacy
Fetch App Privacy details (Data Used to Track You, etc.).

Signature
```ts
privacy({ id, country?, requestOptions? }): Promise<PrivacyDetails>
```

Parameters
- `id` (string|number): Numeric app id (required).
- `country` (string): Default `us` (case-insensitive).
- `requestOptions` (object): HTTP overrides.

Returns
- `PrivacyDetails` structured similarly to Apple’s App Privacy sections, plus `privacyPolicyUrl` (the developer's privacy policy link, or `null`).

Errors
- `ValidationError` when `id` is missing.
- `NotFoundError` when the app is not in the catalog.

### versionHistory
Fetch version history for an app (iOS when available, otherwise the platform the app ships on, e.g. macOS).

Signature
```ts
versionHistory({ id, country?, requestOptions? }): Promise<VersionHistoryItem[]>
```

Parameters
- `id` (string|number): Numeric app id (required).
- `country` (string): Default `us` (case-insensitive).
- `requestOptions` (object): HTTP overrides.

Returns
- `VersionHistoryItem[]` containing `versionDisplay`, `releaseNotes`, `releaseDate`, `releaseTimestamp`.

Errors
- `ValidationError` when `id` is missing.
- `NotFoundError` when the app is not in the catalog.

### inAppPurchases
Fetch the app's top in-app purchases: the list shown under "In-App Purchases" on its App Store page (up to 10, Apple's selection and order).

Signature
```ts
inAppPurchases({ id, country?, requestOptions? }): Promise<InAppPurchase[]>
```

Parameters
- `id` (string|number): Numeric app id (required).
- `country` (string): Storefront; sets the currency and the language of names (default `us`, case-insensitive).
- `requestOptions` (object): HTTP overrides.

Returns
- `InAppPurchase[]` (fields in Types below), or `[]` when the app has no in-app purchases.

Good to know
- One request to Apple's catalog API per app. Apple only serves this data for one app at a time, so there is no batch form: fetching it for 50 search results means 50 requests (use `throttle`).
- Only Apple's top 10 are listed, not the full catalogue of an app's purchases.
- Prices are what the storefront charges today; a subscription's free trial or intro price is not included.
- Also available on `app({ id, inAppPurchases: true })`.

Example
```ts
const iaps = await inAppPurchases({ id: 570060128 });
// [{ id: '1365793322', productId: 'com.duolingo.DuolingoMobile.subscription.Premium.OneMonth…', title: 'Super Duolingo',
//    price: 9.99, currency: 'USD', formattedPrice: '$9.99', subscription: true, subscriptionPeriod: 'P1M' }, …]
```

Errors
- `ValidationError` when `id` is missing.
- `NotFoundError` when the app is not in the catalog.

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
- Object exposing the same methods (with the same types) as the main module, memoized per argument list. Failed calls are not cached.

---

## Types (Returned Objects)

These are the main types returned by the library. Field presence may vary slightly per endpoint/availability.

All of them are exported, along with each method's options type (`AppOptions`, `SearchOptions`, `ListOptions`, …) and `RequestOptions`. `search()` and `list()` are overloaded, so `idsOnly: true` / `fullDetail: true` narrow the return type.

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
  subtitle?: string;                 // App Store subtitle; only with `subtitle: true` (see App subtitles)
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
  // When app({ inAppPurchases: true }) is used:
  inAppPurchases?: InAppPurchase[];  // see InAppPurchase below
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
  voteSum: number;                   // helpful minus not-helpful votes (can be negative)
  voteCount: number;                 // total votes
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
  privacyPolicyUrl: string | null;   // developer's privacy policy link (iOS, or Mac for Mac-only apps)
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

### InAppPurchase
Returned by `inAppPurchases()` and `app({ inAppPurchases: true })`.

```ts
interface InAppPurchase {
  id: string;                        // Apple's id for the purchase
  productId: string;                 // developer's product identifier
  title: string;                     // display name, e.g. 'Super Duolingo'
  description?: string;              // short description, often the same as title
  price: number;                     // e.g. 9.99
  currency: string;                  // ISO 4217, e.g. 'USD'
  formattedPrice: string;            // as the store shows it, e.g. '$9.99' or '9,99 €'
  subscription: boolean;             // auto-renewable subscription?
  subscriptionPeriod?: string;       // ISO 8601 billing period: 'P1W', 'P1M', 'P1Y' (subscriptions only)
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
- Per-call `requestOptions` allow overriding `method`, `headers`, `body`, `timeoutMs`, `proxy`, `rejectUnauthorized`, and cancelling with `signal` (see [Cancelling a call](#cancelling-a-call)).
- Proxy support via `HTTPS_PROXY`/`HTTP_PROXY` (lowercase `https_proxy`/`http_proxy` also honored), using undici's `ProxyAgent` and `fetch`.
- Per-call `throttle` spaces requests `1000 / throttle` ms apart (fractions allowed); retries go through it too.

---

## Errors
All three classes are exported, so you can branch with `instanceof`:

- `ValidationError`: input validation issues (e.g., missing `id`, invalid `collection`).
- `NotFoundError`: unknown app (`app`, `ratings`, `privacy`, `versionHistory`, `reviews` with `appId`) or developer (`developer`).
- `HttpError`: any other non-2xx response; includes `statusCode` and response headers.

```ts
import { privacy, NotFoundError } from 'app-store-scraper-ts';

try {
  await privacy({ id: '1' });
} catch (err) {
  if (err instanceof NotFoundError) console.log('no such app');
  else throw err;
}
```

---

## ESM/CJS
- ESM: `import { app } from 'app-store-scraper-ts'` (Node loads `dist/cjs` and exposes its named exports).
- CJS: `const store = require('app-store-scraper-ts')` (uses `dist/cjs`).

---

## Testing
- Unit tests stub the network (plus one real proxy tunnel against local servers); run `npm test`.
- Integration tests hit Apple live: `INTEGRATION=1 npm test`.
- CI runs on Node 20, 22, 24 and 26.
- Coverage: `npm run test:coverage`.

---

## Reference & Credits
- Upstream: https://github.com/facundoolano/app-store-scraper
- This project follows the reference contract closely while providing a modern TS implementation.

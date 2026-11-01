## Unreleased

- fix(types): `RequestOptions.body` is typed as a fetch body (`RequestInit['body']`) instead of `any`, and the exported `BaseOptions.requestOptions` is now the full `RequestOptions`.
- chore: lint is warning-free. Undici's proxy types replace `any`; Apple's undocumented payloads use one documented `AppleJson` type.

## 0.5.0 - 2026-11-01

- feat: `inAppPurchases({ id, country? })` returns the app's top in-app purchases (up to 10, as on the App Store page) with numeric `price`, `currency`, `formattedPrice`, `productId`, `subscription` and `subscriptionPeriod`; also `app({ inAppPurchases: true })`. One catalog request per app (Apple doesn't allow batching it).
- feat: `requestOptions.signal` (`AbortSignal`) cancels a call: the in-flight request is aborted, nothing is retried, and the promise rejects with the signal's reason.
- feat(reviews): `voteSum` and `voteCount` on each review (already in Apple's feed, previously dropped).
- feat(privacy): `privacyPolicyUrl`, the developer's privacy policy link (iOS, or Mac for Mac-only apps), or `null`.

## 0.4.1 - 2026-11-01

- feat: opt-in `subtitle: true` on `app`, `search`, `developer`, `similar` and `list({ fullDetail: true })` adds each app's real App Store subtitle (`App.subtitle`). Apple's lookup API has no subtitle field, so it comes from the catalog API: one extra request per 99 apps, from the `country` storefront. If that request fails, apps come back without `subtitle` instead of the call failing. See "App subtitles" in the README.
- fix(deps): fast-xml-parser ^5 (4.x is flagged by `npm audit` for GHSA-gh4j-gqv2-49f6; only its XML builder is affected, which this package doesn't use).

## 0.4.0 - 2026-11-01

- BREAKING (types only): `requestOptions` is typed as `RequestOptions` instead of `any`, so unknown keys are now compile errors.
- fix(build): `import { app } from 'app-store-scraper-ts'` failed on Node 22 because `dist/esm` was loaded as CommonJS; ESM consumers now get the CJS build's named exports.
- fix(memoized): failed requests are no longer cached for `maxAge`.
- fix(list): handle Apple feeds that return a single entry as an object (e.g. `num: 1`).
- fix(reviews): resolve `appId` (bundle id) to the numeric id instead of requesting `id=undefined`.
- fix(proxy): move `undici` to `dependencies` so configured proxies work in consumer installs instead of silently going direct.
- fix(http): retry network errors (`TypeError: fetch failed`) like 429/5xx.
- fix(suggest): keep numeric suggestion terms (`2048`, `007`) as strings.
- fix(privacy, versionHistory): Apple's new apps.apple.com no longer embeds the API token, so both always failed; they now use the token-free `apps.apple.com/api/apps/v1/catalog` endpoint (one request instead of two).
- fix(versionHistory): return history for Mac/tvOS-only apps instead of crashing on a missing `ios` key.
- fix(privacy, versionHistory): throw `ValidationError` when called without options and `NotFoundError` on empty catalog data instead of `TypeError`.
- fix(app): don't mutate the caller's options when `ratings: true` is used with `appId`.
- fix(app): only scrape apps.apple.com for screenshots when lookup returned no iPhone screenshots (previously every iPhone-only and Mac app paid an extra request).
- feat: `throttle` is now applied (max requests per second) for app, list, search, developer and similar.
- fix(ratings): parse totals with thousands separators ("4,037,246", "429 205", "271.603"); any app with 1,000+ ratings reported a truncated total.
- fix(memoized): expose `constants` like the main export (top-level constants kept for compatibility).
- fix(proxy): honor lowercase `https_proxy` / `http_proxy`.
- fix(ui): bind the test harness to 127.0.0.1; it exposed proxy credentials and proxy reconfiguration to the local network.
- test(similar): convert the never-run `similar.spec.ts` to JS so it runs in the suite.
- fix(proxy): proxied requests failed on Node 26 (`fetch failed: invalid onError method`) because undici's `ProxyAgent` was handed to Node's built-in fetch; proxied requests now use undici's own `fetch`.
- feat: export `HttpError`, `NotFoundError` and `ValidationError` from the package root so callers can use `instanceof`.
- fix(privacy, versionHistory, ratings): an unknown app id now throws `NotFoundError` instead of `HttpError` 404.
- fix(developer): throw `NotFoundError` (still an `Error`, same message) when the developer has no apps.
- fix(proxy): calls without `country` (`search`, `suggest`, `similar`) now route every request through the `us` storefront's proxy; previously the first request went direct and the follow-up lookup used the US proxy.
- feat(types): `memoized()` is fully typed (was `any`); `privacy()` returns `PrivacyDetails`, `reviews()` returns `Review[]`, `ratings()` returns `Ratings`; `search()`/`list()` narrow on `idsOnly`/`fullDetail`; method option types and `RequestOptions` are exported.
- chore: `engines.node` is `>=20.18.1` (cheerio 1.2 already required it); CI runs Node 20, 22, 24 and 26; mocha 12; license field corrected to MIT to match `LICENSE`.
- fix(app): the screenshot fallback now reads Apple's catalog API (`screenshotsByType`, grouped by device, exact sizes) instead of regex-scraping the apps.apple.com HTML, which could put iPad shots in the iPhone list and pick up unrelated images.
- fix(http): `requestOptions.headers` now override the headers the library sets (case-insensitive), as documented and as upstream does.
- fix(http): retries run in a loop instead of recursion, so each attempt's timeout timer is cleared and its usage event emitted before the next attempt, in order; retries now also respect `throttle`.
- fix(http): `throttle` spaces requests `1000 / throttle` ms apart (fractional values like `0.5` now work) and no longer leaves a `setInterval` running per distinct value. Bursts of N requests at once are no longer allowed.
- perf(similar): resolve `appId` with a plain lookup instead of a full `app()` call; an unknown `appId` throws `NotFoundError`.
- test: retry policy (429/5xx, `Retry-After` seconds and date, no retry on 404, exhaustion, `timeoutMs`), throttle spacing, input validation for every method, memoized expiry/eviction, and a live integration test per endpoint (`INTEGRATION=1`).
- chore: coverage only counts `dist/cjs` (stale build output made local runs fail), `.nyc_output/` is no longer committed, and thresholds were raised to the current level.

## 0.3.0 - 2026-02-05

- fix(app): drop placeholder images and promotional "features" artwork from screenshot lists (published to npm as 0.3.0; the git tag for this commit is `v0.2.1`).

## 0.2.0 - 2025-09-28

- feat(proxy): add per-country proxy map with HTTPS support, TLS opt-out, and usage listener hooks.
- feat(ui): redesign test harness proxy panel for country-specific routing, credential masking, and logging.
- docs: expand README with proxy configuration examples, per-country workflow, and manual verification steps.
- test: add HttpClient coverage for country map routing, CONNECT headers, and fallback behavior.

## 0.1.3 - 2025-09-20

- fix(app): add mzstatic web-scrape fallback when lookup screenshots are empty to restore iPhone/iPad imagery (mirrors reference behavior).

## 0.1.2 - 2025-09-20

- docs(readme): Add per-method parameter docs, return object shapes, constants, and error behavior. Clarify defaults and memoized facade.

## 0.1.1 - 2024-09-01

- chore: Initial public release of the TypeScript port with modules: app, ratings, list, search, developer, suggest, similar, reviews, privacy, versionHistory; ESM/CJS builds; tests; docs scaffolding.

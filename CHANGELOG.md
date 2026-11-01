## Unreleased

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

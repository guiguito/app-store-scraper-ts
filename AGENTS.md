# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source (mirror upstream modules: `app.ts`, `list.ts`, `search.ts`, `developer.ts`, `privacy.ts`, `suggest.ts`, `similar.ts`, `reviews.ts`, `ratings.ts`, `versionHistory.ts`). Entry: `src/index.ts`.
- `src/http/` and `src/utils/`: HTTP client, throttling/retry, parsing helpers.
- `tests/`: Mocha + Chai specs (`*.spec.ts`) matching module names (e.g., `tests/app.spec.ts`).
- `dist/`: Compiled JS output (`dist/esm`, `dist/cjs`).
- `reference/app-store-scraper/`: Upstream JS implementation for parity checks (add `reference/` to `.gitignore`).

## Build, Test, and Development Commands
- Install deps: `npm i` (Node 18+)
- Build: `npm run build`
- Test: `npm test` (unit); integration: `INTEGRATION=1 npm test`
- Coverage: `npm run test:coverage` (nyc over `dist/cjs`)
- Lint/Format: `npm run lint` / `npm run format`
- Docs: `npm run docs` (Typedoc)
- Reference tests: `cd reference/app-store-scraper && npm i && npm test`

## Coding Style & Naming Conventions
- Indentation: 2 spaces; semicolons; single quotes; trailing commas.
- Naming: `camelCase` vars/functions, `PascalCase` types/classes; files match modules (e.g., `app.ts`).
- Imports: explicit local paths; no default exports for modules that expose multiple functions.
- Tooling: ESLint (@typescript-eslint) + Prettier; run `npm run lint:fix` before PRs.

## Testing Guidelines
- Framework: Mocha + Chai + Nock; name tests `*.spec.ts`, mirror upstream.
- Coverage: ≥90% lines/branches; include error paths and locale/country variants.
- Network: stub by default; only a few opt-in integration tests (`INTEGRATION=1`).

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat(list): add genre filter`, `fix(reviews): handle empty pages`). Keep changes focused.
- PRs: include a clear description, linked issues, reproduction steps, and before/after examples (payload snippets or CLI output). Ensure CI passes, lint clean, and tests updated.

## Architecture & Tips
- HTTP + parsing: centralize endpoints, throttle + retry, pure parsers; expose `memoized()`.
- Errors: use typed errors (`ValidationError`, `NotFoundError`, `HttpError`).
- Compatibility: match reference contract/fields; gate enhancements behind options.
- Configuration: proxies via `HTTP_PROXY`/`HTTPS_PROXY`; document env flags; ignore `reference/` in VCS and npm publish.

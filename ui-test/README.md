## UI Test Harness

A minimal website to exercise all endpoints of the library, showing a friendly view and the raw JSON side by side.

How to run
- Build the library CJS output: `npm run build:cjs`
- Start the UI server: `node ui-test/server.js`
- Open http://localhost:3000 in your browser

Notes
- The UI server calls the library on the server side to avoid browser CORS issues against Apple endpoints.
- Set `HTTP_PROXY`/`HTTPS_PROXY` (or lowercase) if you need an outbound proxy; throttling and retries are enabled server-side.
- The server listens on `127.0.0.1` only: its proxy endpoint exposes proxy credentials and can reroute traffic.
- The `ui-test/` directory is git-ignored and is not published.


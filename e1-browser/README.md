# QCL E1 browser gate

Local-only browser fixture against QCL `mdytuysdombxyydqnsmj`. Uses a publishable key and ordinary email/password login. No signup, recovery, admin API, or deploy.

From this directory: `npm_config_cache=./.npm-cache npm ci` then `npm run dev`. Open the printed local URL. Add `?delay=5000` to hold a record response for five seconds after the network reply. Use separate browser profiles for A and B. The page stores a session for reload tests, disables automatic JWT refresh, and clears private state at expiry.

With the dev server running, `npm run browser-gate` runs the A/B, logout/reload and delayed response checks using the ignored operator login file. It prints only PASS/FAIL and needs a local Playwright Chromium. On this macOS 13 host, the current Playwright browser installer did not support Chromium; the successful run used the older Chromium 136 executable with `PLAYWRIGHT_CHROMIUM_EXECUTABLE` pointing into the ignored `.playwright/browsers/` directory.

For expiry, wait until at least `exp + 35s` for a real JWT and verify that the app asks for login with no private data. For C, ask the operator to set `deletion_pending` through the separately reviewed SQL, reload and confirm no record; ask the operator to restore `active` afterward. The app itself cannot change account status.

Never paste fixture credentials into issues, screenshots, logs, or commits. The `e1-review/` REST and SQL gates are separate. This local screen does not implement the v4 product.

Validation on this host: TypeScript/Vite build, local HTTP 200 and automated A/B, logout/reload, delayed A response after logout, delayed A response after B login passed. Genuine JWT expiry and C `deletion_pending` remain unverified.

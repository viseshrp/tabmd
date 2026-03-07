# Testing TabMD

The TabMD build runs locally isolated components and uses `vitest` unit-testing to emulate the browser behaviors securely using `jsdom`.

### Running Tests Locally
```bash
pnpm test
```

### Writing Tests

1. Place pure logic tests inside `tests/unit/`.
2. Place integration-level page renderings in `tests/integration/`.
3. Keep shared test-only utilities under `tests/helpers/` so production code stays free of test scaffolding.
4. Prefer `tests/helpers/flush.ts` for async entrypoint settling instead of `setTimeout(..., 0)` waits.
5. Cover focus-mode transitions with event-driven assertions so layout behavior stays deterministic without time-based waiting.
6. Keep Google Drive backup coverage split between unit tests for auth/API/orchestration and integration tests for the options-page backup and restore flows.

### CI Process
Every pull request on GitHub will automatically trigger the `ci.yml` matrix which invokes:
- `pnpm install`
- `pnpm lint:webext`
- `pnpm quality`
- `pnpm smoke`
- `pnpm exec playwright install --with-deps chromium`
- `pnpm test:e2e`
- `pnpm test`

These ensure nothing gets merged without fully satisfying our storage, Drive backup, and markdown requirements.

# Testing TabMD

The TabMD build runs locally isolated components and uses `vitest` unit-testing to emulate the browser behaviors securely using `jsdom`.

### Running Tests Locally
```bash
pnpm test
```

### Writing Tests

1. Place pure logic tests inside `tests/unit/`.
2. Place integration-level page renderings in `tests/integration/`.
3. Separate mocked storage injections using `tests/helpers/mock_chrome.ts`.

### CI Process
Every pull request on GitHub will automatically trigger the `ci.yml` matrix which invokes:
- `pnpm install`
- `pnpm wxt prepare`
- `pnpm test`

These ensure nothing gets merged without fully satisfying our storage and markdown requirements.

# tabmd

`tabmd` is a WXT-based browser extension skeleton with WXT, GitHub Actions CI/CD, tests, and a Material Design-inspired UI shell.

## Included
- WXT-based MV3 extension scaffold.
- `background`, dashboard, options, drive stub, and shared module entrypoints.
- GitHub Actions for CI, draft releases, and release asset publishing.
- Biome, Vitest, Playwright, and smoke checks.
- Material Design-like dashboard and options UI.

## Development

### Install
```bash
pnpm install
```

### Dev
```bash
pnpm dev
```

### Build
```bash
pnpm build
```

### Package
```bash
pnpm package
```

## Pages
- `tabmd.html`: dashboard skeleton UI.
- `options.html`: settings skeleton page.
- `drive-auth.html`: placeholder auth/status page for future integrations.

## Notes
- The repo is intentionally scaffold-only.
- Replace the placeholder data model and UI wiring with your actual extension logic.

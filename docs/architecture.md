# Architecture

## Layout
- `entrypoints/background`: service worker and browser-action behavior.
- `entrypoints/tabmd`: main dashboard page.
- `entrypoints/options`: settings UI.
- `entrypoints/drive` and `entrypoints/drive-auth`: placeholder future integration surfaces.
- `entrypoints/shared`: storage, utility, and theme primitives.
- `entrypoints/ui`: UI helpers such as snackbars.

## Delivery
- WXT builds the extension.
- Vitest covers logic and bootstrapping.
- Playwright loads the packaged extension in Chromium.
- GitHub Actions handles CI, draft releases, and published release assets.


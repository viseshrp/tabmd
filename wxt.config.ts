import { defineConfig } from 'wxt';

const manifestVersion = process.env.RELEASE_VERSION ?? process.env.npm_package_version ?? '1.0.0';

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',
  vite: () => ({
    build: {
      sourcemap: false
    }
  }),
  manifest: {
    version: manifestVersion,
    name: 'TabMD',
    description: 'Markdown notes in every new tab.',
    homepage_url: 'https://github.com/your-org/tabmd',
    permissions: ['storage', 'unlimitedStorage'],
    action: {
      default_popup: 'popup/index.html',
      default_title: 'TabMD',
      default_icon: {
        16: 'icon/16.png',
        19: 'icon/19.png',
        32: 'icon/32.png',
        38: 'icon/38.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png'
      }
    },
    icons: {
      16: 'icon/16.png',
      19: 'icon/19.png',
      32: 'icon/32.png',
      38: 'icon/38.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png'
    }
  }
});

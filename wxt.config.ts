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
    name: 'tabmd',
    description: 'Material-style WXT extension skeleton.',
    homepage_url: 'https://github.com/your-org/tabmd',
    permissions: ['tabs', 'storage'],
    action: {
      default_title: 'Open tabmd',
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

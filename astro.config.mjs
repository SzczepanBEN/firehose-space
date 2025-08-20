import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  // No adapter needed for static builds
  integrations: [tailwind()],
  site: 'https://firehose.space',
  trailingSlash: 'never',
  build: {
    format: 'directory'
  },
  server: {
    port: 3000
  }
});

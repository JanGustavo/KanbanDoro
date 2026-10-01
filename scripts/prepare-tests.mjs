import { build } from 'vite';
// Tests build their content script in isolation, never overwriting the installed dist or its OAuth configuration.
await build({
  configFile: 'vite.content.config.ts',
  publicDir: false,
  build: { outDir: '.test-dist', emptyOutDir: true },
});

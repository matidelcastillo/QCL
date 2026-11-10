import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 41773,
    strictPort: true,
    fs: { allow: [resolve('.'), resolve('../e1-review')] },
  },
});

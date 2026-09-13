import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

// Dev-only middleware that exposes docs/gauntlet/progress.json to the
// /__gauntlet dashboard without duplicating state into public/.
function gauntletState(): Plugin {
  return {
    name: 'gauntlet-state',
    configureServer(server) {
      server.middlewares.use('/__gauntlet-state/progress.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          res.end(readFileSync(resolve(rootDir, 'docs/gauntlet/progress.json'), 'utf-8'));
        } catch {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'docs/gauntlet/progress.json not found' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [gauntletState()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        gauntlet: resolve(rootDir, '__gauntlet/index.html'),
      },
    },
  },
});

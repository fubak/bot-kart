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
  // GitHub Pages serves the site under /bot-kart/ — the env gate keeps
  // dev server and `vite preview` rooted at '/'.
  base: process.env.GITHUB_PAGES === 'true' ? '/bot-kart/' : '/',
  plugins: [gauntletState()],
  build: {
    // three.js minifies to ~610 kB and can't shrink via chunking — the
    // vendor split above is the actual mitigation; the limit just stops
    // the advisory from crying wolf on every build.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        gauntlet: resolve(rootDir, '__gauntlet/index.html'),
      },
    },
    rolldownOptions: {
      output: {
        // Split three.js into its own vendor chunk — it dwarfs the game
        // code (~600 kB of the ~680 kB bundle) and changes far less
        // often, so separate chunks cache better and drop the main
        // chunk under the size warning.
        advancedChunks: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
});

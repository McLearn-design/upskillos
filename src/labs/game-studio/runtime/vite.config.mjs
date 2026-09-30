// Builds the game runtime (engine + Phaser + the iframe entry) into one
// self-contained script: runtime/dist/game-runtime.js. The editor writes that file
// into the game's sandboxed iframe, and an exported game ships it as it is, so the
// game you test is the game you export (docs/game-studio-architecture.md, ADR 10).
//
//   npm run game:runtime
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    lib: { entry: here('./main.ts'), formats: ['iife'], name: 'GameRuntime', fileName: () => 'game-runtime.js' },
    outDir: here('./dist'),
    emptyOutDir: true,
    target: 'es2020',
    minify: true,
    reportCompressedSize: false,
  },
});

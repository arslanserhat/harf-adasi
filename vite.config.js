import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { rmSync, copyFileSync } from 'node:fs';

export default defineConfig(({ mode }) => mode === 'laravel' ? {
  plugins: [laravel({ input: ['src/game.js'], refresh: ['resources/views/**'] })],
  build: { sourcemap: true },
} : {
  base: '/harf-adasi/',
  plugins: [{
    name: 'static-game-only',
    closeBundle() {
      rmSync('dist/index.php', { force: true });
      rmSync('dist/build', { recursive: true, force: true });
      rmSync('dist/.htaccess', { force: true });
      copyFileSync('.nojekyll', 'dist/.nojekyll');
    },
  }],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
});

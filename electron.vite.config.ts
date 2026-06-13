import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'app/main/index.ts') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'app/preload/index.ts') },
    },
  },
  renderer: {
    root: 'app/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'app/renderer/index.html') },
    },
  },
});

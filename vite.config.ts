import { defineConfig } from 'vite';

// base: './' so the build can be served from Capacitor's file:// WebView
export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});

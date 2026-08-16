import { defineConfig } from "vite";

// base: './' so the build can be served from Capacitor's file:// WebView
export default defineConfig({
  base: "./",
  server: {
    host: true,
    // The dev server is exposed through a Cloudflare Tunnel
    // (alienshy-dev.inshalabs.com) so the phone can load it from any network.
    allowedHosts: true,
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
  },
});

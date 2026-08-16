import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alienshy.alienshy",
  appName: "Alien Heist",
  webDir: "dist",
  backgroundColor: "#0d0b14",
  // DEV MODE: load the game from the local Vite dev server through a
  // Cloudflare Tunnel (stable URL) — code changes hot-reload on the phone.
  // Requires: npm run dev + cloudflared tunnel run shy-bird-dev.
  // To go back to bundled assets, remove this block and rebuild.
  server: {
    url: "https://alienshy-dev.inshalabs.com",
  },
};

export default config;

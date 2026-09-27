import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alienshy.alienshy",
  appName: "Alien Heist",
  webDir: "dist",
  backgroundColor: "#0d0b14",
  // The phone loads the game from the network (Cloudflare Pages), so web
  // changes ship WITHOUT rebuilding the APK: run `npm run deploy` and reload
  // the app. Dev alternative: local Vite + Cloudflare Tunnel for live HMR on
  // the device (`npm run dev:remote`). Remove this block to bundle the built
  // assets inside the APK instead.
  server: {
    url: "https://alienshy.inshalabs.com",
  },
};

export default config;

import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { offlineServiceWorker } from "./scripts/offline-service-worker";

export default defineConfig({
  plugins: [solid({ solid: { moduleName: "@solidjs/web" } }), offlineServiceWorker()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "solid-js/web": "@solidjs/web",
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});

import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import { offlineServiceWorker } from "./scripts/offline-service-worker";

const localFunctionsOrigin = process.env.LOCAL_FUNCTIONS_ORIGIN ?? "http://localhost:8788";

export default defineConfig({
  plugins: [
    solid({ solid: { moduleName: "@solidjs/web" } }),
    tsconfigPaths(),
    offlineServiceWorker(),
  ],
  resolve: {
    alias: {
      "solid-js/web": "@solidjs/web",
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api": {
        target: localFunctionsOrigin,
      },
    },
  },
});

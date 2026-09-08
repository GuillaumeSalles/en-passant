import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^\.\/versionSignal$/,
        replacement: path.resolve("src/lib/app-state/versionSignal.native.ts"),
      },
      { find: "@", replacement: path.resolve("src") },
    ],
  },
  test: { environment: "node", include: ["apps/native/tests/*.test.ts"] },
});

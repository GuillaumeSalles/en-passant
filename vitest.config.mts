import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [solid({ solid: { moduleName: "@solidjs/web" } }), tsconfigPaths()],
  resolve: {
    alias: {
      "solid-js/web": "@solidjs/web",
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**", "tests/e2e/**", "tests/electron/**"],
    server: {
      deps: {
        inline: ["@solidjs/testing-library"],
      },
    },
  },
});

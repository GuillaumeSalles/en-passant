import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solid({ solid: { moduleName: "@solidjs/web" } })],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "solid-js/web": "@solidjs/web",
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**", "tests/e2e/**"],
    server: {
      deps: {
        inline: ["@solidjs/testing-library"],
      },
    },
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [solid({ solid: { moduleName: "@solidjs/web" } }), tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: "solid-js/web",
        replacement: resolve(projectRoot, "node_modules/@solidjs/web/dist/dev.js"),
      },
      {
        find: "@solidjs/router",
        replacement: resolve(projectRoot, "node_modules/@solidjs/router/dist/index.js"),
      },
    ],
  },
  optimizeDeps: {
    exclude: ["@solidjs/web"],
    // Force esbuild to pre-bundle and handle JSX in the router
    include: ["@solidjs/router", "@solidjs/router/dist/routers/components"],
    extensions: [".jsx", ".tsx"],
    esbuildOptions: {
      loader: {
        ".jsx": "jsx",
        ".tsx": "tsx",
      },
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
    deps: {
      optimizer: {
        web: {
          include: ["@solidjs/router"],
        },
      },
    },
  },
});

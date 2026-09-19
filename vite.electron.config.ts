import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: "dist-electron",
    ssr: true,
    rolldownOptions: {
      external: ["electron"],
      input: {
        main: "electron/main.ts",
        preload: "electron/preload.ts",
      },
      output: {
        entryFileNames: "[name].cjs",
        format: "cjs",
      },
    },
    target: "node22",
  },
  ssr: {
    noExternal: true,
    target: "node",
  },
});

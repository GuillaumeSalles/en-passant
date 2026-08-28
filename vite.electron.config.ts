import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: "dist-electron",
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "main.cjs",
        format: "cjs",
      },
    },
    ssr: "electron/main.ts",
    target: "node22",
  },
  ssr: {
    target: "node",
  },
});

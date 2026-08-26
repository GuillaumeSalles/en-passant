import { describe, expect, test } from "vitest";
import { createOfflineServiceWorkerSource } from "./offline-service-worker";

describe("offline service worker", () => {
  test("preloads the shell without intercepting APIs", () => {
    const source = createOfflineServiceWorkerSource("test-version", [
      "/index.html",
      "/assets/index.js",
    ]);

    expect(source).toContain('const SHELL_CACHE = "en-passant-shell-test-version"');
    expect(source).toContain('["/index.html","/assets/index.js"]');
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('caches.match("/index.html")');
  });

  test("only runtime-caches optional assets after they are requested", () => {
    const source = createOfflineServiceWorkerSource("test-version", ["/index.html"]);

    expect(source).toContain('pathname === "/stockfish-18-lite-single.wasm"');
    expect(source).toContain('pathname.startsWith("/sounds/default/")');
    expect(source).toContain("response.status === 200");
    expect(source).toContain("await cache.put(request, response.clone())");
  });

  test("does not intercept range requests or cache partial responses", () => {
    const source = createOfflineServiceWorkerSource("test-version", ["/index.html"]);

    expect(source).toContain('if (request.headers.has("range")) return;');
    expect(source).not.toContain("if (response.ok)");
  });
});

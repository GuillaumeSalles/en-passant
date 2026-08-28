// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { handleAppProtocolRequest } from "./protocol";

describe("app protocol", () => {
  let rendererRoot: string;

  beforeEach(async () => {
    rendererRoot = await mkdtemp(path.join(os.tmpdir(), "en-passant-protocol-"));
    await mkdir(path.join(rendererRoot, "assets"));
    await writeFile(path.join(rendererRoot, "index.html"), "<main>En Passant</main>");
    await writeFile(path.join(rendererRoot, "assets", "app.js"), "export const ready = true;");
  });

  afterEach(async () => {
    await rm(rendererRoot, { recursive: true, force: true });
  });

  test("serves packaged assets with desktop security headers", async () => {
    const response = await handleAppProtocolRequest(new Request("app://enpassant/assets/app.js"), {
      rendererRoot,
      fetchApi: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
    expect(await response.text()).toContain("ready = true");
  });

  test("falls back to index.html for client routes but not missing assets", async () => {
    const routeResponse = await handleAppProtocolRequest(
      new Request("app://enpassant/app/repertoires/example/chapter"),
      { rendererRoot, fetchApi: vi.fn() },
    );
    const assetResponse = await handleAppProtocolRequest(
      new Request("app://enpassant/assets/missing.js"),
      { rendererRoot, fetchApi: vi.fn() },
    );

    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.text()).toBe("<main>En Passant</main>");
    expect(assetResponse.status).toBe(404);
  });

  test("does not serve paths outside the renderer", async () => {
    const response = await handleAppProtocolRequest(
      new Request("app://enpassant/%2e%2e/package.json"),
      { rendererRoot, fetchApi: vi.fn() },
    );

    expect(response.status).toBe(404);
  });

  test("proxies only API requests to the production origin", async () => {
    const fetchApi = vi.fn(async (request: Request) => {
      expect(request.url).toBe("https://enpassant.io/api/sync?full=1");
      expect(request.method).toBe("POST");
      expect(request.credentials).toBe("include");
      expect(request.headers.get("origin")).toBe("https://enpassant.io");
      expect(request.headers.get("referer")).toBe("https://enpassant.io/app");
      expect(request.headers.get("cookie")).toBeNull();
      expect(await request.text()).toBe("changes");
      return new Response("synced", {
        headers: {
          "set-cookie": "session=secret; Secure; HttpOnly",
          "x-pgn-revision": "42",
        },
      });
    });
    const response = await handleAppProtocolRequest(
      new Request("app://enpassant/api/sync?full=1", {
        method: "POST",
        headers: { cookie: "renderer-cookie=untrusted" },
        body: "changes",
      }),
      { rendererRoot, fetchApi },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-pgn-revision")).toBe("42");
    expect(await response.text()).toBe("synced");
    expect(fetchApi).toHaveBeenCalledOnce();
  });

  test("returns a defined offline response when the backend is unavailable", async () => {
    const response = await handleAppProtocolRequest(
      new Request("app://enpassant/api/sync", { method: "POST", body: "{}" }),
      {
        rendererRoot,
        fetchApi: vi.fn(() => Promise.reject(new Error("offline"))),
      },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "desktop_api_unavailable" });
  });
});

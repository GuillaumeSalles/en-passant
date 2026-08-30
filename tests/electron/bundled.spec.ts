import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

const OFFLINE_ARG = "--host-resolver-rules=MAP * ~NOTFOUND";
const PERSISTENCE_KEY = "en_passant_electron_persistence_test";
const EXTERNAL_AUTH_URL_KEY = "EN_PASSANT_TEST_EXTERNAL_AUTH_URL";

test("opens Google PKCE authentication in the external browser", async () => {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "en-passant-electron-auth-"));
  const app = await electron.launch({
    args: [".", OFFLINE_ARG, `--user-data-dir=${userDataDir}`],
    cwd: process.cwd(),
  });

  try {
    await app.evaluate(({ shell }, externalAuthUrlKey) => {
      delete process.env[externalAuthUrlKey];
      Object.defineProperty(shell, "openExternal", {
        configurable: true,
        value: async (url: string) => {
          process.env[externalAuthUrlKey] = url;
        },
      });
    }, EXTERNAL_AUTH_URL_KEY);
    const page = await app.firstWindow();
    await expect(page.locator("[data-square]")).toHaveCount(64);
    await expect.poll(() => page.evaluate(() => window.enPassantDesktop !== undefined)).toBe(true);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();

    let externalAuthUrl = "";
    await expect
      .poll(async () => {
        externalAuthUrl = await app.evaluate(
          (_electron, externalAuthUrlKey) => process.env[externalAuthUrlKey] ?? "",
          EXTERNAL_AUTH_URL_KEY,
        );
        return externalAuthUrl;
      })
      .not.toBe("");

    const url = new URL(externalAuthUrl);
    expect(url.origin).toBe("https://enpassant.io");
    expect(url.pathname).toBe("/app/auth/desktop");
    expect(url.searchParams.get("desktop_auth")).toBe("google");
    expect(url.searchParams.get("client_id")).toBe("electron");
    expect(url.searchParams.get("state")).not.toBe("");
    expect(url.searchParams.get("code_challenge")).not.toBe("");
    expect(page.url()).toContain("app://enpassant/app/");
  } finally {
    await app.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("opens local Google PKCE authentication in the external browser", async () => {
  const rendererServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Local Electron auth test</title>");
  });
  await new Promise<void>((resolve, reject) => {
    rendererServer.once("error", reject);
    rendererServer.listen(0, "localhost", resolve);
  });
  const address = rendererServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not allocate a local Electron renderer port");
  }
  const rendererOrigin = `http://localhost:${address.port}`;
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "en-passant-electron-local-auth-"));
  const app = await electron.launch({
    args: [".", "--en-passant-local-dev", `--user-data-dir=${userDataDir}`],
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_RENDERER_URL: rendererOrigin },
  });

  try {
    await app.evaluate(({ shell }, externalAuthUrlKey) => {
      delete process.env[externalAuthUrlKey];
      Object.defineProperty(shell, "openExternal", {
        configurable: true,
        value: async (url: string) => {
          process.env[externalAuthUrlKey] = url;
        },
      });
    }, EXTERNAL_AUTH_URL_KEY);
    const page = await app.firstWindow();
    await expect.poll(() => page.url()).toBe(`${rendererOrigin}/`);
    const bridgeResult = await page.evaluate(async () => {
      if (window.enPassantDesktop === undefined) return "Desktop bridge is missing";
      try {
        await window.enPassantDesktop.requestGoogleSignIn();
        return "ok";
      } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(bridgeResult).toBe("ok");

    let externalAuthUrl = "";
    await expect
      .poll(async () => {
        externalAuthUrl = await app.evaluate(
          (_electron, externalAuthUrlKey) => process.env[externalAuthUrlKey] ?? "",
          EXTERNAL_AUTH_URL_KEY,
        );
        return externalAuthUrl;
      })
      .not.toBe("");

    const url = new URL(externalAuthUrl);
    expect(url.origin).toBe(rendererOrigin);
    expect(url.pathname).toBe("/app/auth/desktop");
    expect(url.searchParams.get("desktop_auth")).toBe("google");
    expect(url.searchParams.get("client_id")).toBe("electron");
    expect(url.searchParams.get("state")).not.toBe("");
    expect(url.searchParams.get("code_challenge")).not.toBe("");
  } finally {
    await app.close();
    await new Promise<void>((resolve, reject) => {
      rendererServer.close((error) => (error === undefined ? resolve() : reject(error)));
    });
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("starts from the bundle offline and preserves browser storage", async () => {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "en-passant-electron-"));
  const launchOptions = {
    args: [".", OFFLINE_ARG, `--user-data-dir=${userDataDir}`],
    cwd: process.cwd(),
  };

  try {
    const firstApp = await electron.launch(launchOptions);
    const firstPage = await firstApp.firstWindow();

    await expect(firstPage.locator("[data-square]")).toHaveCount(64);
    await expect(firstPage.locator("[data-moves-tree]")).toBeVisible();
    await expect.poll(() => firstPage.url()).toContain("app://enpassant/app/");

    const desktopState = await firstPage.evaluate(async (persistenceKey) => {
      localStorage.setItem(persistenceKey, "preserved");
      const stockfishResponse = await fetch("/stockfish-18-lite-single.js");
      const stockfishReady = await new Promise<boolean>((resolve) => {
        const worker = new Worker("/stockfish-18-lite-single.js");
        const timeout = window.setTimeout(() => {
          worker.terminate();
          resolve(false);
        }, 10_000);
        worker.addEventListener("message", (event: MessageEvent<unknown>) => {
          if (event.data !== "uciok") return;
          window.clearTimeout(timeout);
          worker.terminate();
          resolve(true);
        });
        worker.postMessage("uci");
      });
      const apiResponse = await fetch("/api/desktop-offline-check");
      return {
        apiStatus: apiResponse.status,
        crossOriginIsolated,
        fontLoaded: document.fonts.check('16px "Geist Variable"'),
        serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL ?? null,
        stockfishAvailable: stockfishResponse.ok,
        stockfishReady,
      };
    }, PERSISTENCE_KEY);

    expect(desktopState).toEqual({
      apiStatus: 502,
      crossOriginIsolated: true,
      fontLoaded: true,
      serviceWorkerController: null,
      stockfishAvailable: true,
      stockfishReady: true,
    });
    await firstApp.close();

    const secondApp = await electron.launch(launchOptions);
    const secondPage = await secondApp.firstWindow();
    await expect(secondPage.locator("[data-square]")).toHaveCount(64);
    await expect
      .poll(() => secondPage.evaluate((key) => localStorage.getItem(key), PERSISTENCE_KEY))
      .toBe("preserved");
    await secondApp.close();
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
});

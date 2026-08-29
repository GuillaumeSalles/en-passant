import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const OFFLINE_ARG = "--host-resolver-rules=MAP * ~NOTFOUND";
const PERSISTENCE_KEY = "en_passant_electron_persistence_test";

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

import path from "node:path";
import { app, BrowserWindow, ipcMain, protocol, session, shell } from "electron";
import { APP_URL, SESSION_PARTITION } from "./constants";
import { startGoogleSignIn, type DesktopAuthFlow } from "./desktopAuth";
import {
  GOOGLE_AUTH_COMPLETE_CHANNEL,
  GOOGLE_AUTH_ERROR_CHANNEL,
  REQUEST_GOOGLE_AUTH_CHANNEL,
} from "./ipc";
import { isAllowedExternalUrl, isAllowedMainFrameNavigation, isRendererUrl } from "./navigation";
import { handleAppProtocolRequest } from "./protocol";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

app.enableSandbox();

const isLocalDevelopment = process.argv.includes("--en-passant-local-dev");
const developmentRendererUrl = isLocalDevelopment
  ? process.env["ELECTRON_RENDERER_URL"]
  : undefined;
const rendererUrl = developmentRendererUrl ?? APP_URL;

function rendererRoot(): string {
  return path.resolve(__dirname, "../dist");
}

function configureNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (details) => {
    if (!isAllowedMainFrameNavigation(details.url, rendererUrl)) details.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#09090b",
    webPreferences: {
      partition: SESSION_PARTITION,
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  configureNavigation(window);
  window.once("ready-to-show", () => window.show());
  void window.loadURL(rendererUrl);
  return window;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;
  let desktopAuthFlow: DesktopAuthFlow | null = null;
  let desktopAuthPending = false;

  function ensureMainWindow(): BrowserWindow {
    if (mainWindow !== null && !mainWindow.isDestroyed()) return mainWindow;
    const window = createMainWindow();
    mainWindow = window;
    window.once("closed", () => {
      if (mainWindow === window) mainWindow = null;
    });
    return window;
  }

  function notifyRenderer(channel: string, payload: string): BrowserWindow {
    const window = ensureMainWindow();
    const notify = () => window.webContents.send(channel, payload);
    if (window.webContents.isLoadingMainFrame()) {
      window.webContents.once("did-finish-load", notify);
    } else {
      notify();
    }
    return window;
  }

  app.on("second-instance", () => {
    const window = ensureMainWindow();
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  ipcMain.handle(REQUEST_GOOGLE_AUTH_CHANNEL, async (event) => {
    const senderUrl = event.senderFrame?.url;
    if (senderUrl === undefined || !isRendererUrl(senderUrl, rendererUrl)) {
      throw new Error("Google sign in request came from an untrusted renderer");
    }
    if (desktopAuthPending) return;
    desktopAuthPending = true;
    try {
      const flow = await startGoogleSignIn(session.fromPartition(SESSION_PARTITION));
      desktopAuthFlow = flow;
      void flow.completion
        .then((accountKind) => {
          const window = notifyRenderer(GOOGLE_AUTH_COMPLETE_CHANNEL, accountKind);
          if (window.isMinimized()) window.restore();
          window.focus();
        })
        .catch((error: unknown) => {
          console.error("Failed to complete Google sign in", error);
          notifyRenderer(GOOGLE_AUTH_ERROR_CHANNEL, "Google sign in failed. Please try again.");
        })
        .finally(() => {
          if (desktopAuthFlow === flow) desktopAuthFlow = null;
          desktopAuthPending = false;
        });
    } catch (error: unknown) {
      desktopAuthPending = false;
      throw error;
    }
  });

  app.on("before-quit", () => desktopAuthFlow?.cancel());

  app
    .whenReady()
    .then(() => {
      const desktopSession = session.fromPartition(SESSION_PARTITION);
      desktopSession.setPermissionCheckHandler(() => false);
      desktopSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
      });
      desktopSession.protocol.handle("app", (request) =>
        handleAppProtocolRequest(request, {
          rendererRoot: rendererRoot(),
          fetchApi: (apiRequest) => desktopSession.fetch(apiRequest),
        }),
      );
      ensureMainWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) ensureMainWindow();
      });
    })
    .catch((error: unknown) => {
      console.error("Failed to start En Passant", error);
      app.quit();
    });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

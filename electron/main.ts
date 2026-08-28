import path from "node:path";
import { app, BrowserWindow, protocol, session, shell } from "electron";
import { APP_URL, SESSION_PARTITION } from "./constants";
import {
  isAllowedExternalUrl,
  isAllowedMainFrameNavigation,
  productionAppToDesktopUrl,
} from "./navigation";
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

const developmentRendererUrl = process.env["ELECTRON_RENDERER_URL"];
const rendererUrl =
  !app.isPackaged && developmentRendererUrl !== undefined ? developmentRendererUrl : APP_URL;

function rendererRoot(): string {
  return path.resolve(__dirname, "../dist");
}

function hostedAppBundleUrl(targetUrl: string): string | null {
  const desktopUrl = productionAppToDesktopUrl(targetUrl);
  return desktopUrl;
}

function configureNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (details) => {
    const desktopUrl = hostedAppBundleUrl(details.url);
    if (desktopUrl !== null) {
      details.preventDefault();
      void window.loadURL(desktopUrl);
      return;
    }
    if (!isAllowedMainFrameNavigation(details.url, rendererUrl)) details.preventDefault();
  });
  window.webContents.on("will-redirect", (details) => {
    const desktopUrl = hostedAppBundleUrl(details.url);
    if (desktopUrl === null) return;
    details.preventDefault();
    void window.loadURL(desktopUrl);
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
  app.on("second-instance", () => {
    if (mainWindow === null) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

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
      mainWindow = createMainWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
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

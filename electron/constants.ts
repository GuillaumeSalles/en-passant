import desktopAuth from "../desktop-auth.config.json";

export const APP_HOST = desktopAuth.appHost;
export const APP_ORIGIN = `app://${APP_HOST}`;
export const APP_URL = `${APP_ORIGIN}/app`;
export const API_ORIGIN = desktopAuth.productionAppOrigin;
export const SESSION_PARTITION = "persist:en-passant";
export const ELECTRON_AUTH_CLIENT_ID = desktopAuth.clientId;
export const ELECTRON_AUTH_CALLBACK_PATH = desktopAuth.loopbackCallbackPath;

export type DesktopAuthRuntime = {
  apiOrigin: string;
  signInURL: string;
};

export function resolveDesktopAuthRuntime(options: {
  developmentRendererUrl: string | undefined;
}): DesktopAuthRuntime {
  if (options.developmentRendererUrl === undefined) {
    return {
      apiOrigin: API_ORIGIN,
      signInURL: `${API_ORIGIN}${desktopAuth.brokerPath}`,
    };
  }

  const rendererUrl = new URL(options.developmentRendererUrl);
  if (
    rendererUrl.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(rendererUrl.hostname)
  ) {
    throw new Error("Electron development renderer must use an HTTP loopback origin");
  }

  return {
    apiOrigin: rendererUrl.origin,
    signInURL: new URL(desktopAuth.brokerPath, rendererUrl.origin).toString(),
  };
}

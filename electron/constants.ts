export const APP_HOST = "enpassant";
export const APP_ORIGIN = `app://${APP_HOST}`;
export const APP_URL = `${APP_ORIGIN}/app`;
export const API_ORIGIN = "https://enpassant.io";
export const PRODUCTION_APP_ORIGIN = "https://enpassant.io";
export const SESSION_PARTITION = "persist:en-passant";
export const ELECTRON_AUTH_SCHEME = "io.enpassant.desktop";
export const ELECTRON_AUTH_CLIENT_ID = "electron";
export const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";
const ELECTRON_AUTH_SIGN_IN_PATH = "/app/auth/desktop?desktop_auth=google";

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
      signInURL: `${PRODUCTION_APP_ORIGIN}${ELECTRON_AUTH_SIGN_IN_PATH}`,
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
    signInURL: new URL(ELECTRON_AUTH_SIGN_IN_PATH, rendererUrl.origin).toString(),
  };
}

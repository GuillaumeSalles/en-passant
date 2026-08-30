import type { Session } from "electron";
import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_SCHEME,
  resolveDesktopAuthRuntime,
} from "./constants";
import {
  mirrorAuthCookies,
  parseDesktopAuthDeepLink,
  type DesktopAuthEvent,
} from "./desktopAuthContract";

const memoryStorageValues = new Map<string, unknown>();
const authRuntime = resolveDesktopAuthRuntime({
  developmentRendererUrl: process.argv.includes("--en-passant-local-dev")
    ? process.env["ELECTRON_RENDERER_URL"]
    : undefined,
});

const electronAuthPlugin = electronClient({
  clientID: ELECTRON_AUTH_CLIENT_ID,
  protocol: ELECTRON_AUTH_SCHEME,
  callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
  signInURL: authRuntime.signInURL,
  storage: {
    getItem: (name) => memoryStorageValues.get(name) ?? null,
    setItem: (name, value) => memoryStorageValues.set(name, value),
  },
  userImageProxy: { enabled: false },
});
type DesktopAuthActions = Pick<
  ReturnType<typeof electronAuthPlugin.getActions>,
  "authenticate" | "requestAuth"
>;

const desktopAuthClient = createAuthClient({
  baseURL: authRuntime.apiOrigin,
  basePath: "/api/auth",
  plugins: [
    // @ts-expect-error -- @better-auth/electron 1.7.2 is not exactOptionalPropertyTypes-safe.
    electronAuthPlugin,
  ],
});

function requestElectronAuth(): ReturnType<DesktopAuthActions["requestAuth"]> {
  // @ts-expect-error -- This action exists at runtime despite the upstream plugin type mismatch.
  return desktopAuthClient.requestAuth();
}

function exchangeElectronToken(
  options: Parameters<DesktopAuthActions["authenticate"]>[0],
): ReturnType<DesktopAuthActions["authenticate"]> {
  // @ts-expect-error -- This action exists at runtime despite the upstream plugin type mismatch.
  return desktopAuthClient.authenticate(options);
}

export async function requestGoogleSignIn(): Promise<void> {
  // The Electron client generates PKCE state here and opens signInURL with shell.openExternal.
  await requestElectronAuth();
}

export async function authenticateDesktopDeepLink(
  value: string,
  desktopSession: Session,
): Promise<DesktopAuthEvent | null> {
  const deepLink = parseDesktopAuthDeepLink(value);
  if (deepLink === null) return null;

  let setCookieHeader: string | null = null;
  const result = await exchangeElectronToken({
    token: deepLink.token,
    fetchOptions: {
      onSuccess(context) {
        setCookieHeader = context.response.headers.get("set-cookie");
      },
    },
  });
  if (result.error !== null) {
    throw new Error(result.error.message ?? "Google sign in failed.");
  }
  if (setCookieHeader === null) {
    throw new Error("Google sign in did not create a session.");
  }
  await mirrorAuthCookies(desktopSession, setCookieHeader, authRuntime.apiOrigin);
  return deepLink.authEvent;
}

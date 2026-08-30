import type { AuthEvent } from "./authRedirect";

const PRODUCTION_APP_ORIGIN = "https://enpassant.io";
const ELECTRON_AUTH_SCHEME = "io.enpassant.desktop";
const ELECTRON_AUTH_CLIENT_ID = "electron";
const ELECTRON_AUTH_CALLBACK_PATH = "/auth/callback";
const ELECTRON_AUTH_COOKIE = "better-auth.electron";

export const DESKTOP_AUTH_ERROR_EVENT = "en-passant:desktop-auth-error";

export type DesktopAuthContext = {
  client_id: string;
  state: string;
  code_challenge: string;
};

export function desktopAuthContextFromUrl(value = window.location.href): DesktopAuthContext | null {
  const url = new URL(value);
  const trustedBrokerOrigin =
    url.origin === PRODUCTION_APP_ORIGIN ||
    (import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(url.hostname));
  const clientId = url.searchParams.get("client_id");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  if (
    !trustedBrokerOrigin ||
    url.searchParams.get("desktop_auth") !== "google" ||
    clientId !== ELECTRON_AUTH_CLIENT_ID ||
    state === null ||
    state === "" ||
    codeChallenge === null ||
    codeChallenge === ""
  ) {
    return null;
  }
  return {
    client_id: clientId,
    state,
    code_challenge: codeChallenge,
  };
}

export function desktopAuthDeepLink(event: AuthEvent, token: string): string {
  const query = new URLSearchParams({ auth_event: event });
  return `${ELECTRON_AUTH_SCHEME}:${ELECTRON_AUTH_CALLBACK_PATH}?${query.toString()}#token=${encodeURIComponent(token)}`;
}

export function clearDesktopAuthorizationCookie(): void {
  document.cookie = `${ELECTRON_AUTH_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

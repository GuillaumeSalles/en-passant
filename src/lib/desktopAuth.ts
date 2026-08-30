import type { AuthEvent } from "./authRedirect";
import desktopAuth from "../../desktop-auth.config.json";

const ELECTRON_AUTH_COOKIE = `better-auth.${desktopAuth.clientId}`;
const CALLBACK_VALUE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export const DESKTOP_AUTH_ERROR_EVENT = "en-passant:desktop-auth-error";

export type DesktopAuthContext = {
  client_id: string;
  state: string;
  code_challenge: string;
  loopback_port: string;
  callback_nonce: string;
};

export type DesktopAuthAccountKind = "new" | "existing";

type DesktopAuthAssertionResponse = {
  assertion: string;
};

export function desktopAuthContextFromUrl(value = window.location.href): DesktopAuthContext | null {
  const url = new URL(value);
  const trustedBrokerOrigin =
    url.origin === desktopAuth.productionAppOrigin ||
    (import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(url.hostname));
  const clientId = url.searchParams.get("client_id");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const loopbackPort = url.searchParams.get("loopback_port");
  const callbackNonce = url.searchParams.get("callback_nonce");
  const parsedPort = Number(loopbackPort);
  if (
    !trustedBrokerOrigin ||
    url.searchParams.get("desktop_auth") !== "google" ||
    clientId !== desktopAuth.clientId ||
    state === null ||
    !CALLBACK_VALUE_PATTERN.test(state) ||
    codeChallenge === null ||
    !CALLBACK_VALUE_PATTERN.test(codeChallenge) ||
    loopbackPort === null ||
    !Number.isInteger(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65_535 ||
    String(parsedPort) !== loopbackPort ||
    callbackNonce === null ||
    !CALLBACK_VALUE_PATTERN.test(callbackNonce)
  ) {
    return null;
  }
  return {
    client_id: clientId,
    state,
    code_challenge: codeChallenge,
    loopback_port: loopbackPort,
    callback_nonce: callbackNonce,
  };
}

export function desktopAuthPluginContext(context: DesktopAuthContext): {
  client_id: string;
  state: string;
  code_challenge: string;
} {
  return {
    client_id: context.client_id,
    state: context.state,
    code_challenge: context.code_challenge,
  };
}

export function desktopAuthorizationCode(cookieHeader = document.cookie): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== ELECTRON_AUTH_COOKIE) continue;
    const encodedValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(encodedValue);
    } catch {
      return null;
    }
  }
  return null;
}

export function desktopAuthLoopbackUrl(
  context: DesktopAuthContext,
  token: string,
  assertion: string,
): string {
  const url = new URL(
    `${desktopAuth.loopbackCallbackPath}/${context.callback_nonce}`,
    `http://127.0.0.1:${context.loopback_port}`,
  );
  url.searchParams.set("token", token);
  url.searchParams.set("assertion", assertion);
  return url.toString();
}

export async function requestDesktopAuthAssertion(
  token: string,
  event: AuthEvent,
): Promise<string> {
  const response = await fetch("/api/auth/desktop-assertion", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      accountKind: event === "signup" ? "new" : "existing",
    }),
  });
  if (!response.ok) throw new Error("Desktop authorization could not be created.");
  const result = (await response.json()) as DesktopAuthAssertionResponse;
  return result.assertion;
}

export function clearDesktopAuthorizationCookie(): void {
  document.cookie = `${ELECTRON_AUTH_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

import { ELECTRON_AUTH_CLIENT_ID } from "./constants";

export type DesktopAuthAccountKind = "new" | "existing";

export type DesktopAuthorizationToken = {
  identifier: string;
  state: string;
};

export function parseDesktopAuthorizationToken(token: string): DesktopAuthorizationToken | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const value = parsed as Record<string, unknown>;
  if (
    typeof value["identifier"] !== "string" ||
    value["identifier"] === "" ||
    typeof value["state"] !== "string" ||
    value["state"] === ""
  ) {
    return null;
  }
  return { identifier: value["identifier"], state: value["state"] };
}

export function desktopAuthBrokerUrl(options: {
  signInURL: string;
  state: string;
  codeChallenge: string;
  callbackPort: number;
  callbackNonce: string;
}): string {
  const url = new URL(options.signInURL);
  url.searchParams.set("client_id", ELECTRON_AUTH_CLIENT_ID);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("loopback_port", String(options.callbackPort));
  url.searchParams.set("callback_nonce", options.callbackNonce);
  return url.toString();
}

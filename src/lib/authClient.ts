import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

const DESKTOP_AUTH_BASE_URL = "https://enpassant.io/api/auth";
const DESKTOP_ORIGIN = "app://enpassant";

type FetchInput = string | URL | Request;

export function desktopAuthRequestUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== "https://enpassant.io" || !url.pathname.startsWith("/api/auth/")) {
    throw new Error("Unexpected desktop auth URL");
  }
  return `${DESKTOP_ORIGIN}${url.pathname}${url.search}${url.hash}`;
}

function desktopAuthFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
  const inputUrl = input instanceof Request ? input.url : input.toString();
  const desktopUrl = desktopAuthRequestUrl(inputUrl);
  if (input instanceof Request) {
    return fetch(new Request(desktopUrl, input), init);
  }
  return fetch(desktopUrl, init);
}

const desktopOptions =
  window.location.protocol === "app:"
    ? {
        baseURL: DESKTOP_AUTH_BASE_URL,
        fetchOptions: { customFetchImpl: desktopAuthFetch },
      }
    : {};

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  ...desktopOptions,
});

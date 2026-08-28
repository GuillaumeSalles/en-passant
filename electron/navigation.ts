import { APP_ORIGIN, PRODUCTION_APP_ORIGIN } from "./constants";

const EXTERNAL_HOSTS = new Set([
  "github.com",
  "lichess.org",
  "www.chess.com",
  "www.chessable.com",
  "x.com",
]);

const GOOGLE_AUTH_ORIGINS = new Set(["https://accounts.google.com"]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(value: string): boolean {
  const url = parseUrl(value);
  return url !== null && url.protocol === "https:" && EXTERNAL_HOSTS.has(url.hostname);
}

export function productionAppToDesktopUrl(value: string): string | null {
  const url = parseUrl(value);
  if (
    url === null ||
    url.origin !== PRODUCTION_APP_ORIGIN ||
    (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
  ) {
    return null;
  }
  return `${APP_ORIGIN}${url.pathname}${url.search}${url.hash}`;
}

export function isAllowedMainFrameNavigation(value: string, rendererUrl: string): boolean {
  const url = parseUrl(value);
  const renderer = parseUrl(rendererUrl);
  if (url === null || renderer === null) return false;
  if (url.protocol === renderer.protocol && url.host === renderer.host) return true;
  if (GOOGLE_AUTH_ORIGINS.has(url.origin)) return true;
  return url.origin === PRODUCTION_APP_ORIGIN && url.pathname.startsWith("/api/auth/");
}

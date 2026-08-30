const EXTERNAL_HOSTS = new Set([
  "github.com",
  "lichess.org",
  "www.chess.com",
  "www.chessable.com",
  "x.com",
]);

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

export function isAllowedMainFrameNavigation(value: string, rendererUrl: string): boolean {
  return isRendererUrl(value, rendererUrl);
}

export function isRendererUrl(value: string, rendererUrl: string): boolean {
  const url = parseUrl(value);
  const renderer = parseUrl(rendererUrl);
  if (url === null || renderer === null) return false;
  return url.protocol === renderer.protocol && url.host === renderer.host;
}

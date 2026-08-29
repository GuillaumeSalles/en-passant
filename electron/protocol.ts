import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { API_ORIGIN, APP_HOST } from "./constants";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

const STATIC_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "media-src 'self'",
    "object-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self'",
  ].join("; "),
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

const REQUEST_HEADERS_TO_REPLACE = new Set([
  "accept-encoding",
  "content-length",
  "cookie",
  "host",
  "origin",
  "referer",
]);

const RESPONSE_HEADERS_TO_STRIP = new Set([
  "content-encoding",
  "content-length",
  "set-cookie",
  "set-cookie2",
]);

export type ProtocolHandlerOptions = {
  rendererRoot: string;
  fetchApi: (request: Request) => Promise<Response>;
  apiOrigin?: string | undefined;
};

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function apiHeaders(request: Request, apiOrigin: string): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!REQUEST_HEADERS_TO_REPLACE.has(name) && !name.startsWith("sec-")) {
      headers.set(name, value);
    }
  });
  headers.set("origin", apiOrigin);
  headers.set("referer", `${apiOrigin}/app`);
  return headers;
}

async function proxyApiRequest(
  request: Request,
  fetchApi: ProtocolHandlerOptions["fetchApi"],
  apiOrigin: string,
): Promise<Response> {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, apiOrigin);
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const targetRequest = new Request(targetUrl, {
    method,
    headers: apiHeaders(request, apiOrigin),
    ...(body === undefined ? {} : { body }),
    credentials: "include",
    redirect: "follow",
    signal: request.signal,
  });

  try {
    const response = await fetchApi(targetRequest);
    const headers = new Headers(response.headers);
    for (const name of RESPONSE_HEADERS_TO_STRIP) headers.delete(name);
    return new Response(method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return new Response(JSON.stringify({ error: "desktop_api_unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

function safeRendererPath(rendererRoot: string, pathname: string): string | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativePath = decodedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(rendererRoot, relativePath);
  const relativeToRoot = path.relative(rendererRoot, resolvedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return null;
  return resolvedPath;
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function rendererFilePath(rendererRoot: string, pathname: string): Promise<string | null> {
  const requestedPath = safeRendererPath(rendererRoot, pathname);
  if (requestedPath === null) return null;
  if (await isFile(requestedPath)) return requestedPath;
  if (path.extname(pathname) !== "") return null;
  return path.join(rendererRoot, "index.html");
}

async function serveRendererFile(
  request: Request,
  rendererRoot: string,
  pathname: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, "Method not allowed");
  }
  const filePath = await rendererFilePath(rendererRoot, pathname);
  if (filePath === null) return errorResponse(404, "Not found");
  const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
  const headers = new Headers(STATIC_HEADERS);
  headers.set("content-type", contentType);
  const body = request.method === "HEAD" ? null : await readFile(filePath);
  return new Response(body, { status: 200, headers });
}

export async function handleAppProtocolRequest(
  request: Request,
  options: ProtocolHandlerOptions,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.host !== APP_HOST) return errorResponse(404, "Not found");
  if (isApiPath(url.pathname)) {
    return await proxyApiRequest(request, options.fetchApi, options.apiOrigin ?? API_ORIGIN);
  }
  return await serveRendererFile(request, options.rendererRoot, url.pathname);
}

import { createHash } from "node:crypto";
import type { OutputAsset, OutputChunk } from "rollup";
import type { Plugin } from "vite";

const SERVICE_WORKER_FILE_NAME = "service-worker.js";
const SHELL_CACHE_PREFIX = "en-passant-shell-";
const RUNTIME_CACHE_NAME = "en-passant-runtime-v1";
const ADDITIONAL_SHELL_URLS = ["/index.html", "/openings-4b862275.json"];

function outputContents(output: OutputAsset | OutputChunk): string | Uint8Array {
  return output.type === "chunk" ? output.code : output.source;
}

function shellCacheVersion(bundle: Record<string, OutputAsset | OutputChunk>): string {
  const hash = createHash("sha256");
  for (const output of Object.values(bundle).sort((left, right) =>
    left.fileName.localeCompare(right.fileName),
  )) {
    hash.update(output.fileName);
    hash.update(outputContents(output));
  }
  for (const url of ADDITIONAL_SHELL_URLS) hash.update(url);
  return hash.digest("hex").slice(0, 12);
}

function isShellOutput(output: OutputAsset | OutputChunk): boolean {
  return /\.(?:css|html|js)$/.test(output.fileName) && output.fileName !== SERVICE_WORKER_FILE_NAME;
}

export function createOfflineServiceWorkerSource(
  cacheVersion: string,
  shellUrls: readonly string[],
): string {
  return `const SHELL_CACHE = ${JSON.stringify(`${SHELL_CACHE_PREFIX}${cacheVersion}`)};
const SHELL_CACHE_PREFIX = ${JSON.stringify(SHELL_CACHE_PREFIX)};
const RUNTIME_CACHE = ${JSON.stringify(RUNTIME_CACHE_NAME)};
const SHELL_URLS = ${JSON.stringify(shellUrls)};
const SHELL_PATHS = new Set(SHELL_URLS.map((url) => new URL(url, self.location.origin).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              cacheName.startsWith(SHELL_CACHE_PREFIX) && cacheName !== SHELL_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isOptionalAsset(pathname) {
  return (
    pathname === "/stockfish-18-lite-single.js" ||
    pathname === "/stockfish-18-lite-single.wasm" ||
    pathname.startsWith("/sounds/default/")
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached !== undefined) return cached;
    throw error;
  }
}

async function cachedShellResponse(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  return cached ?? fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match("/index.html");
        if (shell !== undefined) return shell;
        throw new Error("The offline application shell is unavailable");
      }),
    );
    return;
  }

  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(cachedShellResponse(request));
    return;
  }

  if (isOptionalAsset(url.pathname)) event.respondWith(networkFirst(request));
});
`;
}

export function offlineServiceWorker(): Plugin {
  return {
    name: "offline-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const shellUrls = [
        ...Object.values(bundle)
          .filter(isShellOutput)
          .map((output) => `/${output.fileName}`),
        ...ADDITIONAL_SHELL_URLS,
      ].sort();
      const source = createOfflineServiceWorkerSource(shellCacheVersion(bundle), shellUrls);
      this.emitFile({ type: "asset", fileName: SERVICE_WORKER_FILE_NAME, source });
    },
  };
}

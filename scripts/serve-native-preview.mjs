import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("apps/native/dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};
createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const assetRoot = /^\/stockfish-18-lite-single\.(js|wasm)$/.test(pathname)
    ? path.resolve("public")
    : root;
  const filename = path.resolve(assetRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!filename.startsWith(`${assetRoot}/`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filename);
    response.writeHead(200, {
      "content-type": types[path.extname(filename)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(Number(process.argv[2] ?? 8082), "localhost");

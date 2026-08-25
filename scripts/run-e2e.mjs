import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "localhost", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not allocate a local E2E server port");
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

async function main() {
  const port = await availablePort();
  const playwrightBin = path.join(process.cwd(), "node_modules", ".bin", "playwright");
  const forwardedArguments = process.argv.slice(2);
  const offline = forwardedArguments.includes("--offline");
  const testArguments = forwardedArguments.filter((argument) => argument !== "--offline");
  const configArguments = offline ? ["--config", "playwright.offline.config.ts"] : [];
  const child = spawn(playwrightBin, ["test", ...configArguments, ...testArguments], {
    env: { ...process.env, E2E_PORT: String(port) },
    stdio: "inherit",
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

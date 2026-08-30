import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { shell, type Session } from "electron";
import { ELECTRON_AUTH_CALLBACK_PATH, resolveDesktopAuthRuntime } from "./constants";
import {
  desktopAuthBrokerUrl,
  parseDesktopAuthorizationToken,
  type DesktopAuthAccountKind,
} from "./desktopAuthContract";

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const CALLBACK_RESPONSE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>En Passant sign in</title></head><body><p>Sign in received. You can close this tab and return to En Passant.</p></body></html>`;

const authRuntime = resolveDesktopAuthRuntime({
  developmentRendererUrl: process.argv.includes("--en-passant-local-dev")
    ? process.env["ELECTRON_RENDERER_URL"]
    : undefined,
});

type DesktopAssertionResponse = {
  accountKind: DesktopAuthAccountKind;
};

export type DesktopAuthFlow = {
  completion: Promise<DesktopAuthAccountKind>;
  cancel: () => void;
};

function base64UrlRandom(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function closeServer(server: Server): void {
  server.close();
  server.closeAllConnections();
}

async function listenOnLoopback(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address() as AddressInfo | null;
  if (address === null) throw new Error("Desktop sign-in callback did not start.");
  return address.port;
}

async function exchangeAuthorization(options: {
  desktopSession: Session;
  rawToken: string;
  assertion: string;
  expectedState: string;
  codeVerifier: string;
}): Promise<DesktopAuthAccountKind> {
  const token = parseDesktopAuthorizationToken(options.rawToken);
  if (token === null || token.state !== options.expectedState) {
    throw new Error("Desktop sign-in state did not match.");
  }

  const requestOptions: RequestInit = {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      origin: authRuntime.apiOrigin,
    },
  };
  const tokenResponse = await options.desktopSession.fetch(
    `${authRuntime.apiOrigin}/api/auth/electron/token`,
    {
      ...requestOptions,
      body: JSON.stringify({
        token: token.identifier,
        state: token.state,
        code_verifier: options.codeVerifier,
      }),
    },
  );
  if (!tokenResponse.ok) throw new Error("Desktop authorization token was rejected.");

  const assertionResponse = await options.desktopSession.fetch(
    `${authRuntime.apiOrigin}/api/auth/desktop-assertion/verify`,
    {
      ...requestOptions,
      body: JSON.stringify({
        token: options.rawToken,
        assertion: options.assertion,
      }),
    },
  );
  if (!assertionResponse.ok) throw new Error("Desktop authorization was rejected.");
  const result = (await assertionResponse.json()) as DesktopAssertionResponse;
  return result.accountKind;
}

export async function startGoogleSignIn(desktopSession: Session): Promise<DesktopAuthFlow> {
  const state = base64UrlRandom(16);
  const codeVerifier = base64UrlRandom(32);
  const callbackNonce = base64UrlRandom(16);
  let settleCompletion: ((value: DesktopAuthAccountKind) => void) | null = null;
  let rejectCompletion: ((reason: Error) => void) | null = null;
  const completion = new Promise<DesktopAuthAccountKind>((resolve, reject) => {
    settleCompletion = resolve;
    rejectCompletion = reject;
  });
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const server = createServer((request, response) => {
    const callbackUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const expectedPath = `${ELECTRON_AUTH_CALLBACK_PATH}/${callbackNonce}`;
    const token = callbackUrl.searchParams.get("token");
    const assertion = callbackUrl.searchParams.get("assertion");
    if (
      settled ||
      request.method !== "GET" ||
      callbackUrl.pathname !== expectedPath ||
      token === null ||
      token === "" ||
      token.length > 4096 ||
      assertion === null ||
      assertion === "" ||
      assertion.length > 8192
    ) {
      response.writeHead(404, { "cache-control": "no-store" });
      response.end("Not found");
      return;
    }

    settled = true;
    if (timeout !== undefined) clearTimeout(timeout);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    response.end(CALLBACK_RESPONSE);
    closeServer(server);
    void exchangeAuthorization({
      desktopSession,
      rawToken: token,
      assertion,
      expectedState: state,
      codeVerifier,
    }).then(settleCompletion, rejectCompletion);
  });

  try {
    const callbackPort = await listenOnLoopback(server);
    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      closeServer(server);
      rejectCompletion?.(new Error("Desktop sign in timed out."));
    }, AUTH_TIMEOUT_MS);
    await shell.openExternal(
      desktopAuthBrokerUrl({
        signInURL: authRuntime.signInURL,
        state,
        codeChallenge: codeChallenge(codeVerifier),
        callbackPort,
        callbackNonce,
      }),
      { activate: true },
    );
  } catch (error: unknown) {
    settled = true;
    if (timeout !== undefined) clearTimeout(timeout);
    closeServer(server);
    throw error;
  }

  return {
    completion,
    cancel() {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      closeServer(server);
      rejectCompletion?.(new Error("Desktop sign in was cancelled."));
    },
  };
}

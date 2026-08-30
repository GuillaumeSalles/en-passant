// @vitest-environment node

import { describe, expect, test } from "vitest";
import { resolveDesktopAuthRuntime } from "./constants";
import { desktopAuthBrokerUrl, parseDesktopAuthorizationToken } from "./desktopAuthContract";

describe("desktop Google auth", () => {
  test("keeps development auth on the local renderer and uses production when packaged", () => {
    expect(
      resolveDesktopAuthRuntime({ developmentRendererUrl: "http://localhost:5173/app" }),
    ).toEqual({
      apiOrigin: "http://localhost:5173",
      signInURL: "http://localhost:5173/app/auth/desktop?desktop_auth=google",
    });
    expect(resolveDesktopAuthRuntime({ developmentRendererUrl: undefined })).toEqual({
      apiOrigin: "https://enpassant.io",
      signInURL: "https://enpassant.io/app/auth/desktop?desktop_auth=google",
    });
    expect(() =>
      resolveDesktopAuthRuntime({ developmentRendererUrl: "https://attacker.example/app" }),
    ).toThrow("Electron development renderer must use an HTTP loopback origin");
  });

  test("builds the broker URL with the explicit shared client contract", () => {
    const url = new URL(
      desktopAuthBrokerUrl({
        signInURL: "https://enpassant.io/app/auth/desktop?desktop_auth=google",
        state: "state-value",
        codeChallenge: "challenge-value",
        callbackPort: 48_321,
        callbackNonce: "callback-nonce",
      }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      desktop_auth: "google",
      client_id: "electron",
      state: "state-value",
      code_challenge: "challenge-value",
      loopback_port: "48321",
      callback_nonce: "callback-nonce",
    });
  });

  test("parses only complete Better Auth authorization tokens", () => {
    const token = Buffer.from(
      JSON.stringify({ identifier: "authorization-code", state: "expected-state" }),
    ).toString("base64url");
    expect(parseDesktopAuthorizationToken(token)).toEqual({
      identifier: "authorization-code",
      state: "expected-state",
    });
    expect(parseDesktopAuthorizationToken("invalid")).toBeNull();
    expect(
      parseDesktopAuthorizationToken(
        Buffer.from(JSON.stringify({ identifier: "authorization-code" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import {
  desktopAuthContextFromUrl,
  desktopAuthLoopbackUrl,
  desktopAuthPluginContext,
  desktopAuthorizationCode,
} from "./desktopAuth";

const requestQuery =
  "desktop_auth=google&client_id=electron&state=state-value-123456&code_challenge=challenge-value-12345678901234567890&loopback_port=48321&callback_nonce=callback-nonce-123456";

describe("desktop auth browser broker", () => {
  test("reads an exact production Electron PKCE and loopback request", () => {
    const context = desktopAuthContextFromUrl(`https://enpassant.io/app?${requestQuery}`);
    expect(context).toEqual({
      client_id: "electron",
      state: "state-value-123456",
      code_challenge: "challenge-value-12345678901234567890",
      loopback_port: "48321",
      callback_nonce: "callback-nonce-123456",
    });
    expect(
      desktopAuthContextFromUrl(`http://localhost:5174/app/auth/desktop?${requestQuery}`),
    ).not.toBeNull();
    expect(desktopAuthPluginContext(context!)).toEqual({
      client_id: "electron",
      state: "state-value-123456",
      code_challenge: "challenge-value-12345678901234567890",
    });
  });

  test("rejects forged and incomplete broker requests", () => {
    expect(desktopAuthContextFromUrl(`https://attacker.example/app?${requestQuery}`)).toBeNull();
    expect(desktopAuthContextFromUrl(`app://enpassant/app?${requestQuery}`)).toBeNull();
    expect(
      desktopAuthContextFromUrl(`https://enpassant.io/app?${requestQuery.replace("48321", "0")}`),
    ).toBeNull();
    expect(
      desktopAuthContextFromUrl(
        `https://enpassant.io/app?${requestQuery.replace("callback-nonce-123456", "short")}`,
      ),
    ).toBeNull();
  });

  test("builds an exact loopback callback and reads the client-specific cookie", () => {
    const context = desktopAuthContextFromUrl(`https://enpassant.io/app?${requestQuery}`)!;
    expect(desktopAuthLoopbackUrl(context, "token/value", "signed assertion")).toBe(
      "http://127.0.0.1:48321/auth/callback/callback-nonce-123456?token=token%2Fvalue&assertion=signed+assertion",
    );
    expect(
      desktopAuthorizationCode("other=value; better-auth.electron=token%2Fvalue; another=1"),
    ).toBe("token/value");
  });
});

import { describe, expect, test } from "vitest";
import {
  desktopAuthContextFromUrl,
  desktopAuthDeepLink,
  desktopAuthorizationCodeFromUrl,
} from "./desktopAuth";

describe("desktop auth browser broker", () => {
  test("reads an exact production Electron PKCE request", () => {
    expect(
      desktopAuthContextFromUrl(
        "https://enpassant.io/app?desktop_auth=google&client_id=electron&state=state-1&code_challenge=challenge-1",
      ),
    ).toEqual({
      client_id: "electron",
      state: "state-1",
      code_challenge: "challenge-1",
    });
    expect(
      desktopAuthContextFromUrl(
        "http://localhost:5174/app/auth/desktop?desktop_auth=google&client_id=electron&state=state-1&code_challenge=challenge-1",
      ),
    ).not.toBeNull();
  });

  test("rejects forged and incomplete broker requests", () => {
    expect(
      desktopAuthContextFromUrl(
        "https://attacker.example/app?desktop_auth=google&client_id=electron&state=a&code_challenge=b",
      ),
    ).toBeNull();
    expect(
      desktopAuthContextFromUrl(
        "app://enpassant/app?desktop_auth=google&client_id=electron&state=a&code_challenge=b",
      ),
    ).toBeNull();
    expect(
      desktopAuthContextFromUrl(
        "https://enpassant.io/app?desktop_auth=google&client_id=electron&state=a",
      ),
    ).toBeNull();
  });

  test("returns the account kind through the app deep link", () => {
    expect(desktopAuthDeepLink("signup", "token/value")).toBe(
      "io.enpassant.desktop:/auth/callback?auth_event=signup#token=token%2Fvalue",
    );
  });

  test("reads the authorization code from the broker fragment", () => {
    expect(
      desktopAuthorizationCodeFromUrl(
        "http://localhost:5173/app/auth/desktop?auth_event=signin#desktop_token=authorization-code",
      ),
    ).toBe("authorization-code");
    expect(
      desktopAuthorizationCodeFromUrl(
        "http://localhost:5173/app/auth/desktop?auth_event=signin#other=value",
      ),
    ).toBeNull();
  });
});

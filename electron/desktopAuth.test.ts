// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { resolveDesktopAuthRuntime } from "./constants";
import { mirrorAuthCookies, parseDesktopAuthDeepLink } from "./desktopAuthContract";

describe("desktop Google auth", () => {
  test("keeps development auth on the local renderer and uses production when packaged", () => {
    expect(
      resolveDesktopAuthRuntime({
        developmentRendererUrl: "http://localhost:5173/app",
      }),
    ).toEqual({
      apiOrigin: "http://localhost:5173",
      signInURL: "http://localhost:5173/app/auth/desktop?desktop_auth=google",
    });
    expect(
      resolveDesktopAuthRuntime({
        developmentRendererUrl: undefined,
      }),
    ).toEqual({
      apiOrigin: "https://enpassant.io",
      signInURL: "https://enpassant.io/app/auth/desktop?desktop_auth=google",
    });
    expect(() =>
      resolveDesktopAuthRuntime({
        developmentRendererUrl: "https://attacker.example/app",
      }),
    ).toThrow("Electron development renderer must use an HTTP loopback origin");
  });

  test("accepts only the exact PKCE callback deep link", () => {
    expect(
      parseDesktopAuthDeepLink(
        "io.enpassant.desktop:/auth/callback?auth_event=signup#token=authorization-code",
      ),
    ).toEqual({ authEvent: "signup", token: "authorization-code" });
    expect(
      parseDesktopAuthDeepLink(
        "io.enpassant.desktop:/auth/callback?auth_event=unknown#token=authorization-code",
      ),
    ).toBeNull();
    expect(
      parseDesktopAuthDeepLink(
        "io.enpassant.desktop://attacker/auth/callback?auth_event=signin#token=authorization-code",
      ),
    ).toBeNull();
    expect(
      parseDesktopAuthDeepLink(
        "https://enpassant.io/auth/callback?auth_event=signin#token=authorization-code",
      ),
    ).toBeNull();
  });

  test("copies only Better Auth session cookies into Electron's persistent session", async () => {
    const set = vi.fn(() => Promise.resolve());
    await mirrorAuthCookies(
      { cookies: { set } },
      [
        "__Secure-better-auth.session_token=secret; Max-Age=7776000; Path=/; HttpOnly; Secure; SameSite=Lax",
        "better-auth.transfer_token=ignored; Max-Age=300; Path=/; HttpOnly; Secure",
        "attacker.session_token=ignored; Max-Age=300; Path=/; HttpOnly; Secure",
      ].join(", "),
      "https://enpassant.io",
      1_000,
    );

    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({
      url: "https://enpassant.io",
      name: "__Secure-better-auth.session_token",
      value: "secret",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      expirationDate: 7_776_001,
    });
  });

  test("scopes local session cookies to the renderer without forcing Secure", async () => {
    const set = vi.fn(() => Promise.resolve());
    await mirrorAuthCookies(
      { cookies: { set } },
      "better-auth.session_token=local-secret; Max-Age=300; Path=/; HttpOnly; SameSite=Lax",
      "http://localhost:5173",
      1_000,
    );

    expect(set).toHaveBeenCalledWith({
      url: "http://localhost:5173",
      name: "better-auth.session_token",
      value: "local-secret",
      path: "/",
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      expirationDate: 301,
    });
  });
});

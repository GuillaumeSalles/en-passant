// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  isAllowedExternalUrl,
  isAllowedMainFrameNavigation,
  productionAppToDesktopUrl,
} from "./navigation";

describe("desktop navigation policy", () => {
  test("allows only exact external HTTPS hosts", () => {
    expect(isAllowedExternalUrl("https://github.com/GuillaumeSalles/en-passant")).toBe(true);
    expect(isAllowedExternalUrl("https://lichess.org/analysis/standard/example")).toBe(true);
    expect(isAllowedExternalUrl("http://github.com/GuillaumeSalles/en-passant")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.attacker.example/")).toBe(false);
    expect(isAllowedExternalUrl("file:///tmp/example")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });

  test("keeps bundled routes in the renderer", () => {
    expect(
      isAllowedMainFrameNavigation("app://enpassant/app/training", "app://enpassant/app"),
    ).toBe(true);
    expect(isAllowedMainFrameNavigation("app://other/app", "app://enpassant/app")).toBe(false);
  });

  test("allows only the expected OAuth navigation", () => {
    expect(
      isAllowedMainFrameNavigation(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
        "app://enpassant/app",
      ),
    ).toBe(true);
    expect(
      isAllowedMainFrameNavigation(
        "https://enpassant.io/api/auth/callback/google?code=test",
        "app://enpassant/app",
      ),
    ).toBe(true);
    expect(isAllowedMainFrameNavigation("https://attacker.example/", "app://enpassant/app")).toBe(
      false,
    );
  });

  test("maps the hosted callback back to the bundled route", () => {
    expect(
      productionAppToDesktopUrl(
        "https://enpassant.io/app/training?review=due&auth_event=signin#current",
      ),
    ).toBe("app://enpassant/app/training?review=due&auth_event=signin#current");
    expect(productionAppToDesktopUrl("https://enpassant.io/api/auth/get-session")).toBeNull();
    expect(productionAppToDesktopUrl("https://enpassant.io.evil.example/app")).toBeNull();
  });
});

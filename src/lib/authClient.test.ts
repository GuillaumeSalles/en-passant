import { describe, expect, test } from "vitest";
import { desktopAuthRequestUrl } from "./authClient";

describe("desktopAuthRequestUrl", () => {
  test("routes production auth requests through the app protocol", () => {
    expect(desktopAuthRequestUrl("https://enpassant.io/api/auth/get-session?fresh=1")).toBe(
      "app://enpassant/api/auth/get-session?fresh=1",
    );
  });

  test("rejects non-auth and non-production URLs", () => {
    expect(() => desktopAuthRequestUrl("https://enpassant.io/api/sync")).toThrow(
      "Unexpected desktop auth URL",
    );
    expect(() => desktopAuthRequestUrl("https://example.com/api/auth/get-session")).toThrow(
      "Unexpected desktop auth URL",
    );
  });
});

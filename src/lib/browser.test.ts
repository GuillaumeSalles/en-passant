import { afterEach, describe, expect, test, vi } from "vitest";
import { isIosDevice, isSafariBrowser, isStandaloneApp } from "./browser";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PWA browser detection", () => {
  test("detects Safari without treating iOS Chrome as Safari", () => {
    vi.stubGlobal("navigator", {
      vendor: "Apple Computer, Inc.",
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    });
    expect(isSafariBrowser()).toBe(true);

    vi.stubGlobal("navigator", {
      vendor: "Apple Computer, Inc.",
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/126.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 1,
    });
    expect(isSafariBrowser()).toBe(false);
  });

  test("detects touch-capable iPads that identify as Macs", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });

    expect(isIosDevice()).toBe(true);
  });

  test("detects browser and iOS standalone display modes", () => {
    vi.stubGlobal("navigator", { standalone: false });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    expect(isStandaloneApp()).toBe(true);

    vi.stubGlobal("navigator", { standalone: true });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(isStandaloneApp()).toBe(true);
  });
});

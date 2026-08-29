import { describe, expect, test } from "vitest";
import { shouldRegisterServiceWorker } from "./serviceWorker";

describe("shouldRegisterServiceWorker", () => {
  test("registers for production web origins", () => {
    expect(shouldRegisterServiceWorker(true, "https:", true)).toBe(true);
  });

  test("does not register for the bundled desktop renderer", () => {
    expect(shouldRegisterServiceWorker(true, "app:", true)).toBe(false);
  });

  test("does not register in development or unsupported browsers", () => {
    expect(shouldRegisterServiceWorker(false, "https:", true)).toBe(false);
    expect(shouldRegisterServiceWorker(true, "https:", false)).toBe(false);
  });
});

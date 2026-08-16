import { afterEach, expect, test, vi } from "vitest";
import { readLocalStorage, writeLocalStorage } from "./localStorage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

test("reads and writes values", () => {
  expect(readLocalStorage("preference")).toBeNull();

  writeLocalStorage("preference", "enabled");

  expect(readLocalStorage("preference")).toBe("enabled");
});

test("returns null when storage cannot be read", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable");
  });

  expect(readLocalStorage("preference")).toBeNull();
});

test("does not throw when storage cannot be written", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable");
  });

  expect(() => writeLocalStorage("preference", "enabled")).not.toThrow();
});

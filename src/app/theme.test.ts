import { describe, expect, it } from "vitest";
import { applyDefaultTheme } from "./theme";

describe("applyDefaultTheme", () => {
  it("enables class-based dark utilities by default", () => {
    const element = document.createElement("html");

    applyDefaultTheme(element);

    expect(element.classList.contains("dark")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { appShellHasRightPanel } from "./App";

describe("appShellHasRightPanel", () => {
  it("does not reserve the right panel for the training line list", () => {
    expect(appShellHasRightPanel("/app/repertoires/black-repertoire/chapter-3/train")).toBe(false);
  });

  it("keeps the right panel for individual training lines", () => {
    expect(appShellHasRightPanel("/app/repertoires/black-repertoire/chapter-3/train/v1-line")).toBe(
      true,
    );
  });

  it("keeps the right panel for chapter and game detail pages", () => {
    expect(appShellHasRightPanel("/app/repertoires/black-repertoire/chapter-3")).toBe(true);
    expect(appShellHasRightPanel("/app/games/game-1")).toBe(true);
  });
});

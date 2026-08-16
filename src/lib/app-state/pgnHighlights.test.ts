import { describe, expect, test } from "vitest";
import { highlightsFromPgnMetadata, withPgnHighlightMetadata } from "./pgnHighlights";

describe("PGN board highlights", () => {
  test("parses Lichess colored-square and colored-arrow metadata", () => {
    expect(
      highlightsFromPgnMetadata([
        "[%eval 0.32]",
        "[%csl Ra4,Yd5,Gf6,Bh7]",
        "[%cal Ya2a4,Rc3d5,Ge2e4,Ba1a8]",
      ]),
    ).toEqual({
      squares: { a4: "normal", d5: "ctrl", f6: "shift", h7: "alt" },
      arrows: { a2a4: "normal", c3d5: "ctrl", e2e4: "shift", a1a8: "alt" },
    });
  });

  test("ignores invalid shapes and accepts annotation keys and coordinates case-insensitively", () => {
    expect(highlightsFromPgnMetadata(["[%CSL ga4,Xd5,Gz9]", "[%CAL ye2E4,Ra1a1,Gh9h8]"])).toEqual({
      squares: { a4: "shift" },
      arrows: { e2e4: "normal" },
    });
  });

  test("parses Chess.com arrow and highlight metadata", () => {
    expect(
      highlightsFromPgnMetadata([
        "[%c_arrow e5f6;keyPressed;none;opacity;0.8;from;e5;to;f6,d4d5;keyPressed;shift;from;d4;to;d5]",
        "[%c_highlight f6;keyPressed;alt;opacity;0.8;square;f6,e5;keyPressed;control;square;e5]",
      ]),
    ).toEqual({
      squares: { f6: "alt", e5: "ctrl" },
      arrows: { e5f6: "normal", d4d5: "shift" },
    });
  });

  test("replaces shape metadata while preserving unrelated PGN annotations", () => {
    expect(
      withPgnHighlightMetadata(
        [
          "[%clk 0:09:58]",
          "[%cal Ge2e4]",
          "[%eval 0.32]",
          "[%CSL Ra4]",
          "[%c_arrow h2h4;keyPressed;none;from;h2;to;h4]",
        ],
        {
          squares: { a4: "normal", d5: "ctrl", f6: "shift", h7: "alt" },
          arrows: { a2a4: "normal", c3d5: "ctrl", e2e4: "shift", a1a8: "alt" },
        },
      ),
    ).toEqual([
      "[%clk 0:09:58]",
      "[%eval 0.32]",
      "[%csl Ra4,Yd5,Gf6,Bh7]",
      "[%cal Ya2a4,Rc3d5,Ge2e4,Ba1a8]",
    ]);
  });

  test("removes shape annotations when the position has no board highlights", () => {
    expect(
      withPgnHighlightMetadata(["[%cal Ge2e4]", "[%csl Ra4]", "[%eval 0.32]"], {
        squares: {},
        arrows: {},
      }),
    ).toEqual(["[%eval 0.32]"]);
  });
});

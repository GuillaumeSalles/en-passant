import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import type { JSX } from "@solidjs/web";
import { afterEach, expect, test } from "vitest";
import { AppStateProvider } from "@/app/AppStateProvider";
import { STARTING_FEN } from "@/lib/chess";
import {
  chessablePositionUrl,
  chessComPositionUrl,
  lichessPositionUrl,
} from "@/lib/positionShareUrls";
import { TestRouter } from "@/tests/TestRouter";
import { PgnExplorerToolbar } from "./PgnExplorerToolbar";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function Wrapper(props: { children: JSX.Element }) {
  return (
    <TestRouter>
      <AppStateProvider>{props.children}</AppStateProvider>
    </TestRouter>
  );
}

test("opens the current position sharing destinations from the right edge", () => {
  render(() => (
    <Wrapper>
      <PgnExplorerToolbar />
    </Wrapper>
  ));

  const shareButton = screen.getByRole("button", { name: "Share position" });
  expect(shareButton.closest(".ml-auto")).not.toBeNull();

  flush(() => fireEvent.click(shareButton));

  const chessCom = screen.getByRole("link", { name: "Open position in Chess.com" });
  const lichess = screen.getByRole("link", { name: "Open position on Lichess" });
  const chessable = screen.getByRole("link", { name: "Open position in Chessable" });

  expect(chessCom.getAttribute("href")).toBe(chessComPositionUrl(STARTING_FEN));
  expect(lichess.getAttribute("href")).toBe(lichessPositionUrl(STARTING_FEN));
  expect(chessable.getAttribute("href")).toBe(chessablePositionUrl(STARTING_FEN));

  for (const link of [chessCom, lichess, chessable]) {
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  }
});

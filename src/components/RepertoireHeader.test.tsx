import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import type { JSX } from "@solidjs/web";
import { RepertoireHeader } from "./RepertoireHeader";

const selectorValues = vi.hoisted(() => ({
  chapterName: null as string | null,
  repertoireName: null as string | null,
}));
const mergePgn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/useMutation", () => ({
  useMutation: () => mergePgn,
}));

vi.mock("@/lib/useSelector", async () => {
  const appState = await vi.importActual<typeof import("@/lib/AppState")>("@/lib/AppState");

  return {
    useSelector: (selector: unknown) => {
      if (selector === appState.getRepertoireName) {
        return () => selectorValues.repertoireName;
      }

      if (selector === appState.getChapterName) {
        return () => selectorValues.chapterName;
      }

      return () => null;
    },
  };
});

vi.mock("@/lib/useRouteContext", () => ({
  useRouteContext: () => () => ({
    chapterHandle: "chapter-1",
    repertoireHandle: "untitled-repertoire",
    type: "repertoire-builder" as const,
  }),
}));

afterEach(() => {
  cleanup();
  selectorValues.chapterName = null;
  selectorValues.repertoireName = null;
  mergePgn.mockReset();
});

function Wrapper(props: { children: JSX.Element }) {
  return (
    <MemoryRouter root={() => props.children}>
      <Route path="/" component={() => null} />
    </MemoryRouter>
  );
}

function renderHeader() {
  render(() => (
    <Wrapper>
      <RepertoireHeader />
    </Wrapper>
  ));
}

test("shows the title when the repertoire and chapter names are available", () => {
  selectorValues.repertoireName = "Untitled Repertoire";
  selectorValues.chapterName = "Chapter 1";

  renderHeader();

  const repertoireTitle = screen.getByRole("link", { name: "Untitled Repertoire" });
  expect(repertoireTitle).not.toBeNull();
  expect(repertoireTitle.getAttribute("href")).toBe("/app/repertoires/untitled-repertoire");
  expect(repertoireTitle.classList.contains("transition-colors")).toBe(true);
  expect(repertoireTitle.parentElement?.classList.contains("motion-page-title")).toBe(true);
  expect(repertoireTitle.parentElement?.classList.contains("font-normal")).toBe(true);
  const chapterTitle = screen.getByRole("link", { name: "Chapter 1" });
  expect(chapterTitle.getAttribute("href")).toBe("/app/repertoires/untitled-repertoire/chapter-1");
  expect(chapterTitle.classList.contains("transition-colors")).toBe(true);
  expect(screen.getByText("·")).not.toBeNull();
});

test("hides the title when the repertoire name is missing", () => {
  selectorValues.chapterName = "Chapter 1";

  renderHeader();

  expect(screen.queryByText("Chapter 1")).toBeNull();
  expect(screen.queryByText("·")).toBeNull();
});

test("hides the title when the chapter name is missing", () => {
  selectorValues.repertoireName = "Untitled Repertoire";

  renderHeader();

  expect(screen.queryByText("Untitled Repertoire")).toBeNull();
  expect(screen.queryByText("·")).toBeNull();
});

test("places the secondary merge action before Train and merges pasted PGN", async () => {
  renderHeader();

  const mergeButton = screen.getByRole("button", { name: "Merge pgn" });
  const trainButton = screen.getByRole("link", { name: "Train" });
  expect(mergeButton.classList.contains("border-input")).toBe(true);
  expect(mergeButton.querySelector("svg")).toBeNull();
  expect(trainButton.querySelector("svg")).toBeNull();
  expect(mergeButton.compareDocumentPosition(trainButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );

  fireEvent.click(mergeButton);

  expect(await screen.findByRole("dialog", { name: "Merge PGN" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
  const pgn = "1. e4 c5 2. Nf3 *";
  fireEvent.input(screen.getByRole("textbox"), { target: { value: pgn } });
  await Promise.resolve();
  fireEvent.click(screen.getByRole("button", { name: "Merge" }));

  await waitFor(() => expect(mergePgn).toHaveBeenCalledWith(pgn));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Merge PGN" })).toBeNull());
});

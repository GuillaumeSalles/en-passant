import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import type { JSX } from "@solidjs/web";
import { RepertoireHeader } from "./RepertoireHeader";

const selectorValues = vi.hoisted(() => ({
  chapterName: null as string | null,
  repertoireName: null as string | null,
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

  const repertoireTitle = screen.getByText("Untitled Repertoire");
  expect(repertoireTitle).not.toBeNull();
  expect(repertoireTitle.parentElement?.classList.contains("motion-page-title")).toBe(true);
  expect(repertoireTitle.parentElement?.classList.contains("font-normal")).toBe(true);
  expect(screen.getByText("Chapter 1")).not.toBeNull();
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

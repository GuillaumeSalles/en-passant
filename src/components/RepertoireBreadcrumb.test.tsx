import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import type { JSX } from "@solidjs/web";
import { RepertoireBreadcrumb } from "./RepertoireBreadcrumb";

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
    type: "variation-training" as const,
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

function renderBreadcrumb(props: { trainingLineId: string | null } = { trainingLineId: null }) {
  render(() => (
    <Wrapper>
      <RepertoireBreadcrumb showTraining trainingLineId={props.trainingLineId} />
    </Wrapper>
  ));
}

test("links the training breadcrumb trail", () => {
  selectorValues.repertoireName = "Untitled Repertoire";
  selectorValues.chapterName = "Chapter 1";

  renderBreadcrumb();

  expect(screen.getByRole("link", { name: "Untitled Repertoire" }).getAttribute("href")).toBe(
    "/app/repertoires/untitled-repertoire",
  );
  expect(screen.getByRole("link", { name: "Chapter 1" }).getAttribute("href")).toBe(
    "/app/repertoires/untitled-repertoire/chapter-1",
  );
  expect(screen.getByRole("link", { name: "Training" }).getAttribute("href")).toBe(
    "/app/repertoires/untitled-repertoire/chapter-1/train",
  );
});

test("links the current training line breadcrumb", () => {
  selectorValues.repertoireName = "Untitled Repertoire";
  selectorValues.chapterName = "Chapter 1";

  renderBreadcrumb({ trainingLineId: "v1-line" });

  expect(screen.getByRole("link", { name: "Training" }).getAttribute("href")).toBe(
    "/app/repertoires/untitled-repertoire/chapter-1/train",
  );
  expect(screen.getByRole("link", { name: "Line" }).getAttribute("href")).toBe(
    "/app/repertoires/untitled-repertoire/chapter-1/train/v1-line",
  );
});

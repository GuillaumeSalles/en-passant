import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import type { JSX } from "@solidjs/web";
import type { AppState } from "@/lib/AppState";
import { emptyState, normalizePgn } from "@/lib/AppState";
import { createStore, type Store } from "@/lib/createStore";
import { TrainingLines } from "./TrainingLines";

const testContext = vi.hoisted<{ store: Store<AppState> | null }>(() => ({ store: null }));

function getTestStore(): Store<AppState> {
  if (testContext.store === null) throw new Error("Expected the test store to be initialized");
  return testContext.store;
}

vi.mock("@/app/AppStateProvider", () => ({
  useState: () => getTestStore().state,
  useStore: () => getTestStore(),
}));

vi.mock("@/lib/useRouteContext", () => ({
  useRouteContext: () => () => ({
    type: "variation-training" as const,
    repertoireHandle: "white",
    chapterHandle: "main",
  }),
}));

vi.mock("@/lib/useLoadPgn", () => ({ useLoadPgn: () => undefined }));
vi.mock("@/lib/useMutation", () => ({ useMutation: () => () => undefined }));
vi.mock("@/lib/useTrainingMistakeLinks", () => ({
  trainingMistakeLinkKey: () => "mistake",
  useTrainingMistakeLinks: () => () => ({}),
}));
vi.mock("@/components/FullWidthLayout", () => ({
  FullWidthLayout: (props: { children: JSX.Element }) => <>{props.children}</>,
}));
vi.mock("@/components/RepertoireBreadcrumb", () => ({
  RepertoireBreadcrumb: () => <div />,
}));

afterEach(() => {
  cleanup();
  testContext.store = null;
});

test("shows line skeletons until the chapter PGN has loaded", async () => {
  testContext.store = createStore<AppState>({
    ...emptyState(),
    repertoires: {
      status: "success",
      data: {
        repertoire: { id: "repertoire", handle: "white", name: "White", orientation: "white" },
      },
    },
    chapters: {
      status: "success",
      data: {
        chapter: {
          id: "chapter",
          repertoireId: "repertoire",
          handle: "main",
          name: "Main",
          pgnId: "chapter-pgn",
        },
      },
    },
    pgns: { "chapter-pgn": { status: "loading" } },
  });

  render(() => <TrainingLines repertoireHandle="white" chapterHandle="main" missingLine={false} />);

  expect(screen.getByRole("status", { name: "Loading training lines…" })).not.toBeNull();
  expect(document.querySelectorAll("[data-training-line-skeleton]")).toHaveLength(3);

  getTestStore().state.set("pgns", {
    "chapter-pgn": { status: "success", data: normalizePgn("*") },
  });

  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(screen.getByText("Nothing to train")).not.toBeNull();
});

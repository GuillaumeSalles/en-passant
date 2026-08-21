import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import type { JSX } from "@solidjs/web";
import type { AppState } from "@/lib/AppState";
import { emptyState, getTrainingLines, normalizePgn } from "@/lib/AppState";
import { STARTING_FEN } from "@/lib/chess";
import { createStore, type Store } from "@/lib/createStore";
import { TestRouter } from "@/tests/TestRouter";
import { cleanCounter, lineCounter, VariationTraining } from "./VariationTraining";

const testContext = vi.hoisted<{ store: Store<AppState> | null; renderedPositions: string[] }>(
  () => ({
    store: null,
    renderedPositions: [],
  }),
);

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
vi.mock("@/lib/useGlobalShortcuts", () => ({ useGlobalShortcuts: () => undefined }));
vi.mock("@/components/useSquareHighlights", () => ({ useSquareHighlights: () => () => ({}) }));

vi.mock("@/components/WorkspaceLayout", () => ({
  WorkspaceLayout: (props: { chessboard: JSX.Element }) => <>{props.chessboard}</>,
}));

vi.mock("@/components/Chessboard/Chessboard", () => ({
  Chessboard: (props: { position: string }) => (
    <div data-testid="chessboard" data-position={recordRenderedPosition(props.position)} />
  ),
}));

function recordRenderedPosition(position: string): string {
  testContext.renderedPositions.push(position);
  return position;
}

afterEach(() => {
  cleanup();
  testContext.renderedPositions = [];
});

test("counts the active line before it is completed", () => {
  expect(lineCounter(0, 2, false)).toBe("1/2");
  expect(lineCounter(1, 2, false)).toBe("2/2");
  expect(lineCounter(1, 2, true)).toBe("1/2");
  expect(lineCounter(2, 2, true)).toBe("2/2");
});

test("shows clean lines over the total number of queued lines", () => {
  expect(cleanCounter(0, 4)).toBe("0/4");
  expect(cleanCounter(3, 4)).toBe("3/4");
});

test("never renders the previous line while initializing a training route", async () => {
  const chapterPgn = normalizePgn("1. e4 e5 *");
  const previousVariation = normalizePgn("1. d4 d5 *");
  const previousMoveId = Math.max(...Object.keys(previousVariation.moves).map(Number));
  const line = getTrainingLines(chapterPgn, "white")[0];
  if (line === undefined) throw new Error("Expected a training line");

  testContext.store = createStore<AppState>({
    ...emptyState(),
    selectedMoveId: previousMoveId,
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
    pgns: { "chapter-pgn": { status: "success", data: chapterPgn } },
    training: {
      ...emptyState().training,
      variation: previousVariation,
    },
  });

  const view = render(() => (
    <TestRouter>
      <VariationTraining repertoireHandle="white" chapterHandle="main" lineId={line.id} />
    </TestRouter>
  ));

  await waitFor(() => expect(testContext.renderedPositions).toEqual([STARTING_FEN]));

  view.unmount();
  expect(getTestStore().state.training.variation.rootMoveIds).toEqual([]);
  expect(getTestStore().state.training.session?.activeLineId).toBeNull();
});

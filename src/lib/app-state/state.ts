import { STARTING_FEN } from "@/lib/chess";
import { emptyNormalizedPgn } from "./reactivePgn";
import type {
  AppState,
  BoardAnimation,
  Chapter,
  Context,
  EngineSettings,
  Move,
  MutableAppState,
  NewSerializedRepertoire,
  NormalizedPgn,
  Orientation,
  Repertoire,
  SerializedChapter,
} from "./types";

type ChapterScope = {
  repertoire: Repertoire;
  chapter: Chapter;
};

function defaultEngineSettings(): EngineSettings {
  return {
    isEnabled: true,
    depth: 20,
    maxTime: 1000,
    showLines: true,
    showEvalBar: true,
    showBestMoveArrow: true,
    numberOfLines: 1,
  };
}

export function emptyState(): AppState {
  return {
    orientation: "white",
    analysis: [],
    engineSettings: defaultEngineSettings(),
    evaluations: [],
    preselectedVariation: null,
    selectedMoveId: null,
    chapterSelections: {},
    repertoires: {
      status: "not-loaded",
    },
    chapters: {
      status: "not-loaded",
    },
    pgns: {},
    training: {
      status: "in-progress",
      variationIndex: 0,
      variation: emptyNormalizedPgn(),
      session: null,
      reviews: {},
    },
    learning: {
      learnedLineKeys: [],
    },
    highlights: {
      squares: {},
      arrows: {},
    },
    animation: null,
  };
}

export function onRepertoireAndChapterLoad(
  state: MutableAppState,
  _ctx: Context,
  repertoires: NewSerializedRepertoire[],
  chapters: SerializedChapter[],
): void {
  const newRepertoires: Record<string, Repertoire> = {};
  const newChapters: Record<string, Chapter> = {};

  for (const repertoire of repertoires) {
    newRepertoires[repertoire.id] = {
      id: repertoire.id,
      handle: repertoire.handle,
      name: repertoire.name,
      orientation: repertoire.orientation,
    };
  }

  for (const chapter of chapters) {
    newChapters[chapter.id] = {
      id: chapter.id,
      repertoireId: chapter.repertoireId,
      handle: chapter.handle,
      name: chapter.name,
      pgnId: chapter.pgnId,
    };
  }

  state.set("repertoires", {
    status: "success",
    data: newRepertoires,
  });
  state.set("chapters", {
    status: "success",
    data: newChapters,
  });
}

export function getRepertoireByHandle(
  state: AppState,
  repertoireHandle: string,
): Repertoire | undefined {
  return getRepertoireByHandleFromData(state.repertoires.data, repertoireHandle);
}

export function getRepertoire(state: AppState, ctx: Context): Repertoire | undefined {
  return getRepertoireByHandle(state, ctx.repertoireHandle);
}

export function getRepertoireByHandleFromData(
  repertoires: Record<string, Repertoire> | undefined,
  repertoireHandle: string,
): Repertoire | undefined {
  return Object.values(repertoires ?? {}).find(
    (repertoire) => repertoire.handle === repertoireHandle,
  );
}

export function getChapter(
  state: AppState,
  repertoireId: string,
  chapterHandle: string,
): Chapter | undefined {
  return getChapterByHandleFromData(state.chapters.data, repertoireId, chapterHandle);
}

export function getChapterByHandleFromData(
  chapters: Record<string, Chapter> | undefined,
  repertoireId: string,
  chapterHandle: string,
): Chapter | undefined {
  return Object.values(chapters ?? {}).find(
    (chapter) => chapter.repertoireId === repertoireId && chapter.handle === chapterHandle,
  );
}

export function getChapterScopeFromData(
  repertoires: Record<string, Repertoire> | undefined,
  chapters: Record<string, Chapter> | undefined,
  repertoireHandle: string,
  chapterHandle: string,
): ChapterScope | null {
  const repertoire = getRepertoireByHandleFromData(repertoires, repertoireHandle);
  if (repertoire === undefined) {
    return null;
  }

  const chapter = getChapterByHandleFromData(chapters, repertoire.id, chapterHandle);
  if (chapter === undefined) {
    return null;
  }

  return { repertoire, chapter };
}

export function getChapterScopeByHandles(
  state: AppState,
  repertoireHandle: string,
  chapterHandle: string,
): ChapterScope | null {
  return getChapterScopeFromData(
    state.repertoires.data,
    state.chapters.data,
    repertoireHandle,
    chapterHandle,
  );
}

export function getChapterScope(state: AppState, ctx: Context): ChapterScope | null {
  return getChapterScopeByHandles(state, ctx.repertoireHandle, ctx.chapterHandle);
}

export function getTrainingScope(state: AppState, ctx: Context): ChapterScope | null {
  return getChapterScope(state, ctx);
}

export function getChapterPgn(state: AppState, ctx: Context): NormalizedPgn | null {
  const scope = getChapterScope(state, ctx);
  if (scope === null) {
    return null;
  }

  const pgn = state.pgns[scope.chapter.pgnId];
  if (pgn === undefined || pgn.status !== "success") {
    return null;
  }

  return pgn.data;
}

export function getPgnId(state: AppState, ctx: Context): string | null {
  if (ctx.type === "repertoire-builder") {
    const scope = getChapterScope(state, ctx);
    if (scope === null) {
      return null;
    }

    return scope.chapter.pgnId;
  }
  return null;
}

export function getPgn(state: AppState, ctx: Context): NormalizedPgn | null {
  if (ctx.type === "repertoire-builder") {
    return getChapterPgn(state, ctx);
  }

  if (ctx.type === "imported-game") {
    const gamePgn = state.pgns[ctx.gameId];
    return gamePgn?.status === "success" ? gamePgn.data : null;
  }

  return state.training.variation;
}

export function getRepertoireName(state: AppState, ctx: Context): string | null {
  const repertoire = getRepertoire(state, ctx);

  if (repertoire === undefined) {
    return null;
  }

  return repertoire.name;
}

export function getChapterName(state: AppState, ctx: Context): string | null {
  const scope = getChapterScope(state, ctx);
  if (scope === null) {
    return null;
  }

  return scope.chapter.name;
}

export function selectNextMoveIds(state: AppState, ctx: Context): number[] {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return [];
  }

  return getNextMoveIds(state, ctx, pgn);
}

function getChapterSelectionKey(ctx: Context): string | null {
  if (ctx.type !== "repertoire-builder") return null;
  return `${ctx.repertoireHandle}/${ctx.chapterHandle}`;
}

export function selectSelectedMoveId(state: AppState, ctx: Context): number | null {
  const key = getChapterSelectionKey(ctx);
  if (key === null) return state.selectedMoveId;
  return state.chapterSelections[key]?.selectedMoveId ?? null;
}

export function selectPreselectedVariation(state: AppState, ctx: Context): number | null {
  const key = getChapterSelectionKey(ctx);
  if (key === null) return state.preselectedVariation;
  return state.chapterSelections[key]?.preselectedVariation ?? null;
}

export function setChapterSelection(
  state: MutableAppState,
  ctx: Context,
  selectedMoveId: number | null,
  preselectedVariation: number | null,
): void {
  const key = getChapterSelectionKey(ctx);
  if (key === null) {
    state.set("selectedMoveId", selectedMoveId);
    state.set("preselectedVariation", preselectedVariation);
    return;
  }

  state.set("chapterSelections", {
    ...state.chapterSelections,
    [key]: {
      selectedMoveId,
      preselectedVariation,
    },
  });
}

export function updateChapterPreselection(
  state: MutableAppState,
  ctx: Context,
  preselectedVariation: number | null,
): void {
  setChapterSelection(state, ctx, selectSelectedMoveId(state, ctx), preselectedVariation);
}

export function getTurn(state: AppState, ctx: Context): "white" | "black" {
  const pgn = getPgn(state, ctx);
  const selectedMoveId = selectSelectedMoveId(state, ctx);

  if (selectedMoveId === null || pgn === null) {
    return "white";
  }

  const move = pgn.moves[selectedMoveId];
  if (move === undefined) {
    return "white";
  }

  return move.halfMoveNumber % 2 === 1 ? "white" : "black";
}

export function selectedMove(state: AppState, ctx: Context) {
  const selectedMoveId = selectSelectedMoveId(state, ctx);
  if (selectedMoveId === null) {
    return null;
  }

  return selectMoveById(state, ctx, selectedMoveId);
}

export function selectMoveById(state: AppState, ctx: Context, moveId: number): Move | null {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return null;
  }

  return pgn.moves[moveId] ?? null;
}

export function selectFen(state: AppState, ctx: Context) {
  const move = selectedMove(state, ctx);

  if (move === null) {
    return STARTING_FEN;
  }

  return move.fen;
}

export function getNextMoveIds(state: AppState, ctx: Context, pgn: NormalizedPgn) {
  const selectedMoveId = selectSelectedMoveId(state, ctx);
  if (selectedMoveId === null) {
    return pgn.rootMoveIds;
  }
  return pgn.moves[selectedMoveId]?.next ?? pgn.rootMoveIds;
}

export function selectCurrentMove(state: AppState, ctx: Context): Move | null {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return null;
  }

  const selectedMoveId = selectSelectedMoveId(state, ctx);
  if (selectedMoveId === null) {
    if (pgn.rootMoveIds.length === 0) {
      return null;
    }

    const rootMoveId = pgn.rootMoveIds[0];
    return rootMoveId === undefined ? null : (pgn.moves[rootMoveId] ?? null);
  }

  return pgn.moves[selectedMoveId] ?? null;
}

export function selectOrientation(state: AppState, _ctx: Context): Orientation {
  return state.orientation;
}

export function selectAnimation(state: AppState, _ctx: Context): BoardAnimation | null {
  return state.animation;
}

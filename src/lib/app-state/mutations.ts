import {
  applyMove,
  createChessPosition,
  isMoveLegal,
  STARTING_FEN,
  type AppliedMove,
  type AppliedMoveAnimation,
} from "@/lib/chess";
import type { MutationEffect, MutationResult } from "@/lib/useMutation";
import { applyNagToList } from "./nags";
import { toPgn } from "./pgnTree";
import {
  deletePgnMove,
  requireMove,
  requireMoveId,
  setPgnMove,
  setPgnMoveIdCounter,
  setPgnRootMoveIds,
} from "./reactivePgn";
import {
  getNextMoveIds,
  getPgn,
  getPgnId,
  selectFen,
  selectPreselectedVariation,
  selectSelectedMoveId,
  setChapterSelection,
  updateChapterPreselection,
} from "./state";
import type {
  AppState,
  Context,
  EvalMove,
  Move,
  MutableAppState,
  NormalizedPgn,
  Orientation,
  BoardAnimation,
  MoveAnnotations,
  MovePath,
  PgnMutation,
} from "./types";

type VariationStart =
  | { type: "move"; parentId: number; childId: number }
  | { type: "root"; childId: number };

type MoveInput = {
  from: string;
  to: string;
  promotion: string | null;
};

type MoveData = {
  san: string;
  fen: string;
  from: string;
  to: string;
  promotion: string | null;
  animation: AppliedMoveAnimation | null;
};

let boardAnimationId = 0;

export function flipBoard(state: MutableAppState): void {
  state.set("orientation", (orientation) => (orientation === "white" ? "black" : "white"));
}

export function setBoardOrientation(
  state: MutableAppState,
  _ctx: Context,
  orientation: Orientation,
): void {
  state.set("orientation", orientation);
}

function moveSoundEffect(move: Move | undefined): MutationEffect | undefined {
  if (move === undefined) return undefined;
  return { type: "play-sound", sound: move.san.includes("x") ? "Capture" : "Move" };
}

function newMoveEffects(move: Move): MutationEffect[] {
  const sound = moveSoundEffect(move);
  return sound === undefined
    ? [{ type: "record-cached-move" }]
    : [sound, { type: "record-cached-move" }];
}

function uci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function movePath(pgn: NormalizedPgn, moveId: number | null): MovePath {
  const path: string[] = [];
  let currentId = moveId;
  while (currentId !== null) {
    const currentMove = requireMove(pgn.moves, currentId);
    path.unshift(uci(currentMove));
    currentId = currentMove.prev;
  }
  return path;
}

function moveAnnotations(move: Move): MoveAnnotations {
  const metadata =
    move.metadata.length > 0
      ? move.metadata
      : move.clock !== null
        ? [`[%clk ${move.clock}]`]
        : move.timeSpent !== null
          ? [`[%emt ${move.timeSpent}]`]
          : [];
  const commentAfter = [
    ...metadata,
    ...(move.commentAfter === null || move.commentAfter === "" ? [] : [move.commentAfter]),
  ].join(" ");
  return {
    nags: [...move.nags],
    commentBefore: move.commentBefore,
    commentAfter: commentAfter === "" ? null : commentAfter,
  };
}

function pgnMutationEffect(
  state: MutableAppState,
  ctx: Context,
  pgn: NormalizedPgn,
  mutation: PgnMutation,
): MutationEffect | undefined {
  if (ctx.type !== "repertoire-builder") return undefined;
  const pgnId = getPgnId(state, ctx);
  if (pgnId === null) return undefined;
  return {
    type: "persist-pgn-mutation",
    pgnId,
    pgn: toPgn(pgn),
    mutation,
  };
}

function compactEffects(...effects: MutationResult[]): MutationEffect[] {
  return effects.flatMap((effect) => effect ?? []);
}

function nextBoardAnimation(animation: AppliedMoveAnimation): BoardAnimation {
  return {
    ...animation,
    id: ++boardAnimationId,
  };
}

function reverseAnimation(animation: AppliedMoveAnimation): AppliedMoveAnimation {
  return {
    movements: animation.movements.map((movement) => ({
      piece: movement.piece,
      from: movement.to,
      to: movement.from,
    })),
    captures: [],
    promotion: null,
  };
}

function setBoardAnimation(
  state: MutableAppState,
  animation: AppliedMoveAnimation | null,
  animate: boolean,
): void {
  state.set("animation", animate && animation !== null ? nextBoardAnimation(animation) : null);
}

function applyStoredMove(fen: string, move: Move): AppliedMove | null {
  try {
    return applyMove(createChessPosition(fen), {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
  } catch {
    return null;
  }
}

function promotionFromPiece(piece: string): string | null {
  return piece[1]?.toLowerCase() ?? null;
}

function applyMoveFromCurrentPosition(
  state: AppState,
  ctx: Context,
  input: MoveInput,
): MoveData | null {
  try {
    const result = applyMove(createChessPosition(selectFen(state, ctx)), input);
    return {
      san: result.san,
      fen: result.fen,
      from: input.from,
      to: input.to,
      promotion: result.promotion,
      animation: result.animation,
    };
  } catch {
    return null;
  }
}

export function back(state: MutableAppState, ctx: Context, animate = true): MutationResult {
  const pgn = getPgn(state, ctx);
  const selectedMoveId = selectSelectedMoveId(state, ctx);

  if (pgn === null || selectedMoveId === null) {
    return;
  }

  const move = pgn.moves[selectedMoveId];
  if (move === undefined) {
    setChapterSelection(state, ctx, null, null);
    return;
  }

  const previousFen = move.prev === null ? STARTING_FEN : (pgn.moves[move.prev]?.fen ?? null);
  const appliedMove = previousFen === null ? null : applyStoredMove(previousFen, move);

  if (move.prev === null) {
    setChapterSelection(state, ctx, null, null);
    setBoardAnimation(
      state,
      appliedMove === null ? null : reverseAnimation(appliedMove.animation),
      animate,
    );
    return;
  }

  setChapterSelection(state, ctx, move.prev, null);
  setBoardAnimation(
    state,
    appliedMove === null ? null : reverseAnimation(appliedMove.animation),
    animate,
  );
  return moveSoundEffect(pgn.moves[move.prev]);
}

export function forward(state: MutableAppState, ctx: Context, animate = true): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const nextMoveIds = getNextMoveIds(state, ctx, pgn);

  if (nextMoveIds.length === 0) {
    return;
  }

  const preselectedVariation = selectPreselectedVariation(state, ctx);
  const selectedMoveId =
    preselectedVariation === null || !nextMoveIds.includes(preselectedVariation)
      ? nextMoveIds[0]
      : preselectedVariation;
  if (selectedMoveId === undefined) return;

  const selectedMove = pgn.moves[selectedMoveId];
  if (selectedMove === undefined) return;

  const appliedMove = applyStoredMove(selectFen(state, ctx), selectedMove);

  setChapterSelection(state, ctx, selectedMoveId, null);
  setBoardAnimation(state, appliedMove?.animation ?? null, animate);
  return moveSoundEffect(selectedMove);
}

export function isMoveValid(
  state: AppState,
  ctx: Context,
  from: string,
  to: string,
  piece: string,
): boolean {
  return isMoveLegal(createChessPosition(selectFen(state, ctx)), {
    from,
    to,
    promotion: promotionFromPiece(piece),
  });
}

export function moveFromChessboard(
  state: MutableAppState,
  ctx: Context,
  from: string,
  to: string,
  piece: string,
): MutationResult {
  const appliedMove = applyMoveFromCurrentPosition(state, ctx, {
    from,
    to,
    promotion: promotionFromPiece(piece),
  });
  if (appliedMove === null) return;

  return move(state, ctx, { ...appliedMove, animate: false });
}

export function moveFromEvalMove(
  state: MutableAppState,
  ctx: Context,
  { from, to, promotion }: EvalMove,
  animate = true,
): MutationResult {
  const appliedMove = applyMoveFromCurrentPosition(state, ctx, { from, to, promotion });
  if (appliedMove === null) return;

  return move(state, ctx, { ...appliedMove, animate });
}

function move(
  state: MutableAppState,
  ctx: Context,
  {
    san,
    fen,
    from,
    to,
    promotion,
    animation,
    animate,
  }: {
    san: string;
    fen: string;
    from: string;
    to: string;
    promotion: string | null;
    animation: AppliedMoveAnimation | null;
    animate: boolean;
  },
): MutationResult {
  const pgn = getPgn(state, ctx);

  if (pgn === null) {
    return;
  }

  const newId = pgn.moveIdCounter + 1;
  const selectedMoveId = selectSelectedMoveId(state, ctx);

  if (selectedMoveId === null) {
    const existingMove = pgn.rootMoveIds.find((id) => pgn.moves[id]?.san === san);

    if (existingMove !== undefined) {
      setChapterSelection(state, ctx, existingMove, null);
      setBoardAnimation(state, animation, animate);
      return moveSoundEffect(pgn.moves[existingMove]);
    }

    const newMove: Move = {
      id: newId,
      san,
      nags: [],
      fen,
      from,
      to,
      promotion,
      next: [],
      prev: null,
      halfMoveNumber: 0,
      clock: null,
      commentBefore: null,
      commentAfter: null,
      metadata: [],
      timeSpent: null,
      timeSpentShare: null,
    };

    setPgnMoveIdCounter(pgn, newId);
    setPgnRootMoveIds(pgn, [...pgn.rootMoveIds, newId]);
    setPgnMove(pgn, newMove);

    setChapterSelection(state, ctx, newId, null);
    setBoardAnimation(state, animation, animate);
    return compactEffects(
      newMoveEffects(newMove),
      pgnMutationEffect(state, ctx, pgn, {
        type: "addMove",
        parentPath: [],
        move: uci(newMove),
        annotations: moveAnnotations(newMove),
      }),
    );
  }

  const currentMove = pgn.moves[selectedMoveId];
  if (currentMove === undefined) {
    setChapterSelection(state, ctx, null, null);
    return move(state, ctx, {
      san,
      fen,
      from,
      to,
      promotion,
      animation,
      animate,
    });
  }

  const existingMove = currentMove.next.find((id) => pgn.moves[id]?.san === san);

  if (existingMove !== undefined) {
    setChapterSelection(state, ctx, existingMove, null);
    setBoardAnimation(state, animation, animate);
    return moveSoundEffect(pgn.moves[existingMove]);
  }

  const newMove: Move = {
    id: newId,
    san,
    nags: [],
    fen,
    from,
    to,
    promotion,
    next: [],
    prev: currentMove.id,
    halfMoveNumber: currentMove.halfMoveNumber + 1,
    clock: null,
    commentBefore: null,
    commentAfter: null,
    metadata: [],
    timeSpent: null,
    timeSpentShare: null,
  };

  setPgnMoveIdCounter(pgn, newId);
  setPgnMove(pgn, {
    ...currentMove,
    next: [...currentMove.next, newId],
  });
  setPgnMove(pgn, newMove);

  setChapterSelection(state, ctx, newId, null);
  setBoardAnimation(state, animation, animate);
  return compactEffects(
    newMoveEffects(newMove),
    pgnMutationEffect(state, ctx, pgn, {
      type: "addMove",
      parentPath: movePath(pgn, currentMove.id),
      move: uci(newMove),
      annotations: moveAnnotations(newMove),
    }),
  );
}

export function moveToStart(state: MutableAppState, ctx: Context): void {
  setChapterSelection(state, ctx, null, null);
}

export function arrowUp(state: MutableAppState, ctx: Context): void {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const nextMoveIds = getNextMoveIds(state, ctx, pgn);

  if (nextMoveIds.length < 2) {
    moveToStart(state, ctx);
    return;
  }

  const preselectedVariation = selectPreselectedVariation(state, ctx);
  if (preselectedVariation === null) {
    updateChapterPreselection(state, ctx, requireMoveId(nextMoveIds[nextMoveIds.length - 1]));
  } else {
    const index = nextMoveIds.indexOf(preselectedVariation);

    updateChapterPreselection(
      state,
      ctx,
      requireMoveId(nextMoveIds[(index - 1 + nextMoveIds.length) % nextMoveIds.length]),
    );
  }
}

export function addEvalMoves(
  state: MutableAppState,
  ctx: Context,
  moves: EvalMove[],
): MutationResult {
  const effects: MutationEffect[] = [];
  for (const evalMove of moves) {
    const result = moveFromEvalMove(state, ctx, evalMove);
    effects.push(...compactEffects(result));
  }
  return effects;
}

export function moveToLastMainLineMove(state: MutableAppState, ctx: Context): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  if (pgn.rootMoveIds.length === 0) {
    return;
  }

  let id = requireMoveId(pgn.rootMoveIds[0]);

  while (true) {
    const move = pgn.moves[id];
    const nextId = move?.next[0];
    if (nextId === undefined) break;
    id = nextId;
  }

  setChapterSelection(state, ctx, id, null);
  return moveSoundEffect(pgn.moves[id]);
}

export function spacebar(state: MutableAppState, ctx: Context, animate = true): MutationResult {
  if (ctx.type !== "repertoire-builder") {
    return;
  }

  if (state.evaluations.length === 0) {
    return;
  }

  const bestLine = state.evaluations[0];
  const bestMove = bestLine?.moves[0];

  if (bestMove === undefined) {
    return;
  }

  return moveFromEvalMove(state, ctx, bestMove, animate);
}

export function arrowDown(state: MutableAppState, ctx: Context): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const nextMoveIds = getNextMoveIds(state, ctx, pgn);

  if (nextMoveIds.length < 2) {
    return moveToLastMainLineMove(state, ctx);
  }

  const preselectedVariation = selectPreselectedVariation(state, ctx);
  if (preselectedVariation === null) {
    updateChapterPreselection(state, ctx, requireMoveId(nextMoveIds[1]));
  } else {
    const index = nextMoveIds.indexOf(preselectedVariation);

    updateChapterPreselection(
      state,
      ctx,
      requireMoveId(nextMoveIds[(index + 1 + nextMoveIds.length) % nextMoveIds.length]),
    );
  }
}

export function selectMove(state: MutableAppState, ctx: Context, moveId: number): MutationResult {
  const pgn = getPgn(state, ctx);
  if (selectSelectedMoveId(state, ctx) === moveId) {
    return;
  }

  setChapterSelection(state, ctx, moveId, null);
  return moveSoundEffect(pgn?.moves[moveId]);
}

export function updateMoveCommentAfter(
  state: MutableAppState,
  ctx: Context,
  moveId: number,
  commentAfter: string,
): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const move = pgn.moves[moveId];
  if (move === undefined) {
    return;
  }

  const updatedMove = {
    ...move,
    commentAfter: commentAfter.trim() === "" ? null : commentAfter,
  };
  setPgnMove(pgn, updatedMove);
  return pgnMutationEffect(state, ctx, pgn, {
    type: "setAnnotations",
    path: movePath(pgn, moveId),
    annotations: moveAnnotations(updatedMove),
  });
}

export function updateMoveCommentBefore(
  state: MutableAppState,
  ctx: Context,
  moveId: number,
  commentBefore: string,
): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const move = pgn.moves[moveId];
  if (move === undefined) {
    return;
  }

  const updatedMove = {
    ...move,
    commentBefore: commentBefore.trim() === "" ? null : commentBefore,
  };
  setPgnMove(pgn, updatedMove);
  return pgnMutationEffect(state, ctx, pgn, {
    type: "setAnnotations",
    path: movePath(pgn, moveId),
    annotations: moveAnnotations(updatedMove),
  });
}

export function copyMoveLearningDetails(
  state: MutableAppState,
  ctx: Context,
  sourceMove: Move,
): void {
  const pgn = getPgn(state, ctx);
  const selectedMoveId = selectSelectedMoveId(state, ctx);
  if (pgn === null || selectedMoveId === null) return;

  const revealedMove = pgn.moves[selectedMoveId];
  if (revealedMove === undefined) return;

  setPgnMove(pgn, {
    ...revealedMove,
    nags: [...sourceMove.nags],
    commentBefore: sourceMove.commentBefore,
    commentAfter: sourceMove.commentAfter,
    metadata: [...sourceMove.metadata],
  });
}

export function setNagOnSelectedMove(
  state: MutableAppState,
  ctx: Context,
  nag: number,
): MutationResult {
  const pgn = getPgn(state, ctx);
  const selectedMoveId = selectSelectedMoveId(state, ctx);
  if (pgn === null || selectedMoveId === null) {
    return;
  }

  const move = pgn.moves[selectedMoveId];
  if (move === undefined) {
    return;
  }

  const updatedMove = {
    ...move,
    nags: applyNagToList(move.nags, nag),
  };
  setPgnMove(pgn, updatedMove);
  return pgnMutationEffect(state, ctx, pgn, {
    type: "setAnnotations",
    path: movePath(pgn, selectedMoveId),
    annotations: moveAnnotations(updatedMove),
  });
}

function findStartOfVariation(pgn: NormalizedPgn, moveId: number): VariationStart {
  let id = moveId;

  while (true) {
    const move = requireMove(pgn.moves, id);
    const parentId = move.prev;

    if (parentId === null) {
      return { type: "root", childId: id };
    }

    const parentMove = requireMove(pgn.moves, parentId);

    if (parentMove.next[0] !== id || parentMove.next.length > 1) {
      return {
        type: "move",
        parentId,
        childId: id,
      };
    } else {
      id = parentId;
    }
  }
}

function reorderVariationEffect(
  state: MutableAppState,
  ctx: Context,
  pgn: NormalizedPgn,
  variation: VariationStart,
): MutationEffect | undefined {
  const parentPath = variation.type === "root" ? [] : movePath(pgn, variation.parentId);
  const childIds =
    variation.type === "root" ? pgn.rootMoveIds : requireMove(pgn.moves, variation.parentId).next;
  return pgnMutationEffect(state, ctx, pgn, {
    type: "reorderVariations",
    parentPath,
    childMoves: childIds.map((id) => uci(requireMove(pgn.moves, id))),
  });
}

export function promoteVariation(
  state: MutableAppState,
  ctx: Context,
  moveId: number,
): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const result = findStartOfVariation(pgn, moveId);

  if (result.type === "root") {
    const newRootMoveIds = pgn.rootMoveIds.filter((id) => id !== result.childId);
    newRootMoveIds.unshift(result.childId);

    setPgnRootMoveIds(pgn, newRootMoveIds);
    return reorderVariationEffect(state, ctx, pgn, result);
  }

  const { parentId, childId } = result;

  const parentMove = requireMove(pgn.moves, parentId);
  const newNextMoves = parentMove.next.filter((id) => id !== childId);
  newNextMoves.unshift(childId);

  setPgnMove(pgn, {
    ...parentMove,
    next: newNextMoves,
  });
  return reorderVariationEffect(state, ctx, pgn, result);
}

function* flatten(move: Move, moves: Record<number, Move>): Generator<Move> {
  for (const id of move.next) {
    yield* flatten(requireMove(moves, id), moves);
  }
  yield move;
}

export function deleteMove(state: MutableAppState, ctx: Context, moveId: number): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const move = pgn.moves[moveId];
  if (move === undefined) {
    return;
  }
  const path = movePath(pgn, moveId);

  if (move.prev !== null) {
    const previousMove = requireMove(pgn.moves, move.prev);
    setPgnMove(pgn, {
      ...previousMove,
      next: previousMove.next.filter((id) => id !== moveId),
    });
  }

  const moveIdsToDelete = Array.from(flatten(move, pgn.moves), ({ id }) => id);

  for (const id of moveIdsToDelete) {
    deletePgnMove(pgn, id);
  }

  if (move.prev === null) {
    setPgnRootMoveIds(
      pgn,
      pgn.rootMoveIds.filter((id) => id !== moveId),
    );
  }

  setChapterSelection(state, ctx, move.prev, null);
  return pgnMutationEffect(state, ctx, pgn, { type: "deleteSubtree", path });
}

export function moveVariationUp(
  state: MutableAppState,
  ctx: Context,
  moveId: number,
): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const variation = findStartOfVariation(pgn, moveId);
  reorderVariation(pgn, variation, "up");
  return reorderVariationEffect(state, ctx, pgn, variation);
}

export function moveVariationDown(
  state: MutableAppState,
  ctx: Context,
  moveId: number,
): MutationResult {
  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return;
  }

  const variation = findStartOfVariation(pgn, moveId);
  reorderVariation(pgn, variation, "down");
  return reorderVariationEffect(state, ctx, pgn, variation);
}

function reorderVariation(
  pgn: NormalizedPgn,
  variation: VariationStart,
  direction: "up" | "down",
): void {
  if (variation.type === "root") {
    setPgnRootMoveIds(pgn, moveVariationInList(pgn.rootMoveIds, variation.childId, direction));
    return;
  }

  const parentMove = requireMove(pgn.moves, variation.parentId);
  setPgnMove(pgn, {
    ...parentMove,
    next: moveVariationInList(parentMove.next, variation.childId, direction),
  });
}

function moveVariationInList(
  moveIds: number[],
  moveId: number,
  direction: "up" | "down",
): number[] {
  const index = moveIds.indexOf(moveId);
  if (index === -1) {
    throw new Error("Variation not found");
  }

  if (direction === "up" && index === 0) {
    throw new Error("Variation is already at the top");
  }

  if (direction === "down" && index === moveIds.length - 1) {
    throw new Error("Variation is already at the bottom");
  }

  return immutableSwap(moveIds, index, direction === "up" ? index - 1 : index + 1);
}

function immutableSwap(array: number[], firstIndex: number, secondIndex: number): number[] {
  const result = [...array];
  result[firstIndex] = requireMoveId(array[secondIndex]);
  result[secondIndex] = requireMoveId(array[firstIndex]);
  return result;
}

export function toggleEngine(state: MutableAppState) {
  state.set("engineSettings", {
    ...state.engineSettings,
    isEnabled: !state.engineSettings.isEnabled,
  });
}

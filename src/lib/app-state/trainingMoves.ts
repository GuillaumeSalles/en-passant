import { getChapterScope, getChapterPgn } from "./state";
import { createChessPosition, positionKey, STARTING_FEN } from "../chess";
import { getVariationMoveIds } from "./training";
import { trainingLineId } from "./trainingLines";
import {
  DEFAULT_TRAINING_INTERVALS_MS,
  TRAINING_ALGORITHM_VERSION,
  trainingLineReviewKey,
} from "./spacedRepetition";
import type {
  AppState,
  Context,
  Move,
  NormalizedPgn,
  Orientation,
  TrainingLineReview,
} from "./types";

export type TrainingMoveIdentity = {
  repertoireId: string;
  positionKey: string;
  uci: string;
};
export type TrainingMoveReview = TrainingMoveIdentity & {
  intervalIndex: number;
  dueAt: number;
  lastReviewedAt: number;
  algorithmVersion: number;
  successes: number;
  lapses: number;
  lastOutcome: "learned" | "correct" | "incorrect";
};
export type TrainingMoveOutcome = TrainingMoveReview["lastOutcome"];
export type TrainingMoveTarget = TrainingMoveIdentity & {
  key: string;
  moveId: number;
  san: string;
  ply: number;
  lineId: string;
  uciPath: string;
};

export function trainingMoveReviewKey(identity: TrainingMoveIdentity): string {
  return JSON.stringify([identity.repertoireId, identity.positionKey, identity.uci]);
}

export function getTrainingMoveTarget(
  repertoireId: string,
  pgn: NormalizedPgn,
  moveId: number,
  orientation: Orientation,
): TrainingMoveTarget | null {
  const move = pgn.moves[moveId];
  if (move === undefined) return null;
  const previous = move.prev === null ? null : pgn.moves[move.prev];
  if (previous === undefined) return null;
  const before = positionKey(createChessPosition(previous?.fen ?? STARTING_FEN));
  if ((before.split(" ")[1] === "w" ? "white" : "black") !== orientation) return null;
  const path = getVariationMoveIds(pgn, moveId)
    .map((id) => pgn.moves[id])
    .filter((entry): entry is Move => entry !== undefined);
  const uci = (entry: Move) => `${entry.from}${entry.to}${entry.promotion ?? ""}`;
  const identity = { repertoireId, positionKey: before, uci: uci(move) };
  return {
    ...identity,
    key: trainingMoveReviewKey(identity),
    moveId,
    san: move.san,
    ply: path.length,
    lineId: trainingLineId(path),
    uciPath: path.map(uci).join(" "),
  };
}

export function getTrainingMoveTargets(
  repertoireId: string,
  pgn: NormalizedPgn,
  orientation: Orientation,
): TrainingMoveTarget[] {
  const targets = new Map<string, TrainingMoveTarget>();
  const pending = [...pgn.rootMoveIds].reverse();
  const visited = new Set<number>();
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    const move = pgn.moves[id];
    if (move === undefined) continue;
    const target = getTrainingMoveTarget(repertoireId, pgn, move.id, orientation);
    if (target !== null && !targets.has(target.key)) targets.set(target.key, target);
    pending.push(...[...move.next].reverse());
  }
  return [...targets.values()];
}

export function getLineMoveTargets(
  repertoireId: string,
  pgn: NormalizedPgn,
  orientation: Orientation,
  uciPath: string,
): TrainingMoveTarget[] {
  const targets = new Map<string, TrainingMoveTarget>();
  let candidates = pgn.rootMoveIds;
  for (const uci of uciPath.split(" ")) {
    const id = candidates.find((candidate) => {
      const move = pgn.moves[candidate];
      return move !== undefined && `${move.from}${move.to}${move.promotion ?? ""}` === uci;
    });
    if (id === undefined) return [];
    const target = getTrainingMoveTarget(repertoireId, pgn, id, orientation);
    if (target !== null) targets.set(target.key, target);
    candidates = pgn.moves[id]?.next ?? [];
  }
  return [...targets.values()];
}

// Context moves are played without grading. Stop before the first new or due decision.
export function getTrainingMovesToSkip(
  repertoireId: string,
  pgn: NormalizedPgn,
  orientation: Orientation,
  remainingMoveIds: readonly number[],
  reviews: Readonly<Record<string, TrainingMoveReview>>,
  now: number,
): Move[] {
  const skipped: Move[] = [];
  for (const moveId of remainingMoveIds) {
    const move = pgn.moves[moveId];
    if (move === undefined) break;
    const target = getTrainingMoveTarget(repertoireId, pgn, moveId, orientation);
    if (target !== null) {
      const review = reviews[target.key];
      if (review === undefined || !(review.dueAt > now)) break;
    }
    skipped.push(move);
  }
  return skipped;
}

export function nextTrainingMoveReview(
  identity: TrainingMoveIdentity,
  current: TrainingMoveReview | undefined,
  outcome: TrainingMoveOutcome,
  now: number,
): TrainingMoveReview {
  // Demonstrations and early successful practice do not advance or reset an existing schedule.
  if (
    current !== undefined &&
    (outcome === "learned" || (outcome === "correct" && now < current.dueAt))
  ) {
    return current;
  }
  const intervalIndex =
    current === undefined || outcome !== "correct"
      ? 0
      : Math.min(current.intervalIndex + 1, DEFAULT_TRAINING_INTERVALS_MS.length - 1);
  return {
    repertoireId: identity.repertoireId,
    positionKey: identity.positionKey,
    uci: identity.uci,
    intervalIndex,
    dueAt:
      now + (DEFAULT_TRAINING_INTERVALS_MS[intervalIndex] ?? DEFAULT_TRAINING_INTERVALS_MS[0] ?? 0),
    lastReviewedAt: now,
    algorithmVersion: TRAINING_ALGORITHM_VERSION,
    successes: (current?.successes ?? 0) + (outcome === "correct" ? 1 : 0),
    lapses: (current?.lapses ?? 0) + (outcome === "incorrect" ? 1 : 0),
    lastOutcome: outcome,
  };
}

export function trainingMoveProgress(
  targets: readonly TrainingMoveTarget[],
  reviews: Readonly<Record<string, TrainingMoveReview>>,
  now: number,
) {
  const scheduled = targets.flatMap((target) => {
    const review = reviews[target.key];
    return review === undefined ? [] : [review];
  });
  const learned = scheduled.length;
  return {
    total: targets.length,
    learned,
    familiar: scheduled.filter((review) => review.intervalIndex >= 1).length,
    due: scheduled.filter((review) => review.dueAt <= now).length,
    intervalIndex:
      learned === targets.length && learned > 0
        ? Math.min(...scheduled.map((review) => review.intervalIndex))
        : undefined,
    dueAt: learned === 0 ? undefined : Math.min(...scheduled.map((review) => review.dueAt)),
  };
}

// A derived line summary for existing line navigation. It is never persisted as mastery.
export function lineReviewFromMoves(
  repertoireId: string,
  chapterId: string,
  pgn: NormalizedPgn,
  orientation: Orientation,
  uciPath: string,
  reviews: Readonly<Record<string, TrainingMoveReview>>,
): TrainingLineReview | undefined {
  const targets = getLineMoveTargets(repertoireId, pgn, orientation, uciPath);
  const progress = trainingMoveProgress(targets, reviews, 0);
  if (progress.dueAt === undefined) return undefined;
  return {
    repertoireId,
    chapterId,
    uciPath,
    intervalIndex: progress.intervalIndex ?? 0,
    dueAt: progress.dueAt,
    lastReviewedAt: Math.max(...targets.map((target) => reviews[target.key]?.lastReviewedAt ?? 0)),
    algorithmVersion: TRAINING_ALGORITHM_VERSION,
  };
}

export function reviewForTrainingLine(
  state: AppState,
  ctx: Context,
  uciPath: string,
): TrainingLineReview | undefined {
  const scope = getChapterScope(state, ctx);
  const pgn = getChapterPgn(state, ctx);
  if (scope === null || pgn === null) return undefined;
  const derived = lineReviewFromMoves(
    scope.repertoire.id,
    scope.chapter.id,
    pgn,
    scope.repertoire.orientation,
    uciPath,
    state.training.moveReviews,
  );
  const legacy =
    state.training.reviews[trainingLineReviewKey(scope.repertoire.id, scope.chapter.id, uciPath)];
  const targets = getLineMoveTargets(
    scope.repertoire.id,
    pgn,
    scope.repertoire.orientation,
    uciPath,
  );
  if (
    targets.length > 0 &&
    targets.every((target) => state.training.moveReviews[target.key] !== undefined)
  )
    return derived;
  if (legacy === undefined) return derived;
  if (derived === undefined) return legacy;
  return { ...derived, dueAt: Math.min(derived.dueAt, legacy.dueAt) };
}

import {
  getTrainingMoveTargets,
  getLineMoveTargets,
  type TrainingMoveReview,
} from "./trainingMoves";
import { getVariationMoveIds } from "./training";
import { getTrainingLineByUciPath, type TrainingLine } from "./trainingLines";
import type { Chapter, NormalizedPgn, Repertoire, TrainingLineReview } from "./types";
import { isTrainingReviewDue, trainingLineReviewKey } from "./spacedRepetition";

export type ScheduledTrainingLine = {
  key: string;
  repertoire: Repertoire;
  chapter: Chapter;
  line: TrainingLine;
  review: TrainingLineReview;
  label: string;
  isDue: boolean;
  startMove?: number;
};

export function getScheduledTrainingLines(
  repertoires: Readonly<Record<string, Repertoire>>,
  chapters: Readonly<Record<string, Chapter>>,
  pgns: Readonly<Record<string, NormalizedPgn>>,
  reviews: Readonly<Record<string, TrainingLineReview>>,
  now: number,
  moveReviews: Readonly<Record<string, TrainingMoveReview>> = {},
): ScheduledTrainingLine[] {
  const scheduledLines: ScheduledTrainingLine[] = [];

  for (const review of Object.values(reviews)) {
    const repertoire = repertoires[review.repertoireId];
    const chapter = chapters[review.chapterId];
    if (repertoire === undefined || chapter?.repertoireId !== repertoire.id) continue;

    const pgn = pgns[chapter.pgnId];
    if (pgn === undefined) continue;

    const line = getTrainingLineByUciPath(pgn, repertoire.orientation, review.uciPath);
    if (line === undefined) continue;

    const targets = getLineMoveTargets(repertoire.id, pgn, repertoire.orientation, review.uciPath);
    if (targets.length > 0 && targets.every((target) => moveReviews[target.key] !== undefined))
      continue;

    const label = getVariationMoveIds(pgn, line.terminalMoveId)
      .map((moveId) => pgn.moves[moveId]?.san)
      .filter((san) => san !== undefined)
      .join(" ");

    scheduledLines.push({
      key: trainingLineReviewKey(review.repertoireId, review.chapterId, review.uciPath),
      repertoire,
      chapter,
      line,
      review,
      label,
      isDue: isTrainingReviewDue(review, now),
    });
  }

  const included = new Set<string>();
  for (const chapter of Object.values(chapters).sort((a, b) => a.id.localeCompare(b.id))) {
    const repertoire = repertoires[chapter.repertoireId];
    const pgn = pgns[chapter.pgnId];
    if (repertoire === undefined || pgn === undefined) continue;
    for (const target of getTrainingMoveTargets(repertoire.id, pgn, repertoire.orientation)) {
      const review = moveReviews[target.key];
      if (review === undefined || included.has(target.key)) continue;
      included.add(target.key);
      const line = getTrainingLineByUciPath(pgn, repertoire.orientation, target.uciPath);
      if (line === undefined) continue;
      scheduledLines.push({
        key: target.key,
        repertoire,
        chapter,
        line,
        review: { ...review, chapterId: chapter.id, uciPath: target.uciPath },
        label: `${Math.ceil(target.ply / 2)}${target.ply % 2 === 0 ? "..." : "."} ${target.san}`,
        isDue: review.dueAt <= now,
        startMove: target.ply,
      });
    }
  }

  return scheduledLines.sort((left, right) => {
    const dueAtDifference = left.review.dueAt - right.review.dueAt;
    if (dueAtDifference !== 0) return dueAtDifference;
    return left.key.localeCompare(right.key);
  });
}

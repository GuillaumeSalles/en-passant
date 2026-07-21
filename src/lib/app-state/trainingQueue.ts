import { getVariationMoveIds } from "./training";
import { getTrainingLines, type TrainingLine } from "./trainingLines";
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
};

export function getScheduledTrainingLines(
  repertoires: Readonly<Record<string, Repertoire>>,
  chapters: Readonly<Record<string, Chapter>>,
  pgns: Readonly<Record<string, NormalizedPgn>>,
  reviews: Readonly<Record<string, TrainingLineReview>>,
  now: number,
): ScheduledTrainingLine[] {
  const scheduledLines: ScheduledTrainingLine[] = [];

  for (const review of Object.values(reviews)) {
    const repertoire = repertoires[review.repertoireId];
    const chapter = chapters[review.chapterId];
    if (repertoire === undefined || chapter?.repertoireId !== repertoire.id) continue;

    const pgn = pgns[chapter.pgnId];
    if (pgn === undefined) continue;

    const line = getTrainingLines(pgn, repertoire.orientation).find(
      (candidate) => candidate.uciPath === review.uciPath,
    );
    if (line === undefined) continue;

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

  return scheduledLines.sort((left, right) => {
    const dueAtDifference = left.review.dueAt - right.review.dueAt;
    if (dueAtDifference !== 0) return dueAtDifference;
    return left.key.localeCompare(right.key);
  });
}

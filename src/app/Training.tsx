import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { TrainingLineList, type TrainingLineListItem } from "@/components/TrainingLineList";
import { TrainingReviewButton } from "@/components/TrainingReviewButton";
import { getScheduledTrainingLines, movePositionKey } from "@/lib/AppState";
import {
  importedGamePath,
  repertoireMovePath,
  trainingLinePath,
  trainingLineReviewPath,
  trainingQueuePath,
} from "@/lib/routes";
import { useLoadPgns } from "@/lib/useLoadPgn";
import { useLoadRepertoiresAndChapters } from "@/lib/useLoadRepertoiresAndChapters";
import { useMutation } from "@/lib/useMutation";
import { trainingMistakeLinkKey, useTrainingMistakeLinks } from "@/lib/useTrainingMistakeLinks";
import { ensureTrainingQueueReview } from "@/mutations/trainingSession";

export function Training() {
  const state = useState();
  const location = useLocation();
  const navigate = useNavigate();
  const onEnsureTrainingQueueReview = useMutation(ensureTrainingQueueReview);
  const [now, setNow] = createSignal(Date.now());
  const clock = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clock));

  useLoadRepertoiresAndChapters();
  const mistakeLinks = useTrainingMistakeLinks();

  const scheduledPgnIds = createMemo(() => {
    if (state.chapters.status !== "success") return [];
    const chapterById = state.chapters.data;
    return Object.values(state.training.reviews)
      .map((review) => chapterById[review.chapterId]?.pgnId)
      .filter((pgnId) => pgnId !== undefined);
  });
  useLoadPgns(() => scheduledPgnIds());

  const isLoading = createMemo(() => {
    if (state.repertoires.status !== "success" || state.chapters.status !== "success") return true;
    return scheduledPgnIds().some((pgnId) => {
      const result = state.pgns[pgnId];
      return result === undefined || result.status === "not-loaded" || result.status === "loading";
    });
  });
  const loadedPgns = createMemo(() =>
    Object.fromEntries(
      Object.entries(state.pgns).flatMap(([pgnId, result]) =>
        result.status === "success" ? [[pgnId, result.data]] : [],
      ),
    ),
  );
  const lines = createMemo(() => {
    if (state.repertoires.status !== "success" || state.chapters.status !== "success") return [];
    return getScheduledTrainingLines(
      state.repertoires.data,
      state.chapters.data,
      loadedPgns(),
      state.training.reviews,
      now(),
    );
  });
  const dueCount = createMemo(() => lines().filter((line) => line.isDue).length);
  const nextDueLine = createMemo(() => lines().find((line) => line.isDue));
  const reviewHref = createMemo(() => {
    const line = nextDueLine();
    return line === undefined
      ? undefined
      : trainingLineReviewPath(line.repertoire.handle, line.chapter.handle, line.line.id);
  });
  const listItems = createMemo<TrainingLineListItem[]>(() =>
    lines().map((line) => {
      const mistakeLink =
        mistakeLinks()[trainingMistakeLinkKey(line.chapter.id, line.line.uciPath)];
      const pgn = loadedPgns()[line.chapter.pgnId];
      const selectedPositionKey =
        pgn === undefined ? "" : (movePositionKey(pgn, line.line.terminalMoveId) ?? "");
      return {
        id: line.line.id,
        label: line.label,
        intervalIndex: line.review.intervalIndex,
        isAlternative: line.line.isAlternative,
        isLearned: true,
        dueAt: line.review.dueAt,
        detailLinks:
          mistakeLink === undefined
            ? undefined
            : [
                {
                  href: importedGamePath(mistakeLink.game.id),
                  label: `Review game vs ${mistakeLink.game.opponentName}`,
                },
              ],
        viewHref: repertoireMovePath(
          line.repertoire.handle,
          line.chapter.handle,
          selectedPositionKey,
        ),
        primaryHref: trainingLinePath(line.repertoire.handle, line.chapter.handle, line.line.id),
        queueKey: line.key,
        trainingStatus: line.isDue ? "due" : "trained",
      };
    }),
  );

  createEffect(
    () => ({
      continueReviewing: new URLSearchParams(location.search).get("review") === "due",
      dueCount: dueCount(),
      isLoading: isLoading(),
      nextLine: nextDueLine(),
      reviewQueue: state.training.reviewQueue,
    }),
    ({ continueReviewing, dueCount, isLoading, nextLine, reviewQueue }) => {
      if (!continueReviewing || isLoading) return;
      if (nextLine === undefined) {
        navigate(trainingQueuePath(), { replace: true });
        return;
      }
      if (reviewQueue === null || reviewQueue.total < reviewQueue.reviewed + dueCount) {
        onEnsureTrainingQueueReview(dueCount);
      }
      navigate(
        trainingLineReviewPath(
          nextLine.repertoire.handle,
          nextLine.chapter.handle,
          nextLine.line.id,
        ),
        { replace: true },
      );
    },
  );

  return (
    <FullWidthLayout
      title={<h1 class="truncate text-base font-medium">Training</h1>}
      reserveRightSlot
      showMobileHeaderDivider={false}
    >
      <div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-medium">Training queue</h2>
            <div class="text-sm text-muted-foreground">
              {dueCount()} due · {lines().length} scheduled
            </div>
          </div>
          <TrainingReviewButton count={dueCount()} href={reviewHref()} />
        </div>

        <TrainingLineList
          lines={listItems()}
          loading={isLoading()}
          now={now()}
          emptyMessage="No lines are scheduled yet. Learn a repertoire line to add it here."
        />
      </div>
    </FullWidthLayout>
  );
}

export default Training;

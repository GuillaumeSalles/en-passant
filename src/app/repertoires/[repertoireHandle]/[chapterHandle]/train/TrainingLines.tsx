import { useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { TrainingLineList, type TrainingLineListItem } from "@/components/TrainingLineList";
import { Button } from "@/components/ui/button";
import {
  getChapterPgn,
  getTrainingLinesWithScheduledPaths,
  getVariationMoveIds,
  isTrainingReviewDue,
  movePositionKey,
  prioritizeDueTrainingLines,
  selectOrientation,
} from "@/lib/AppState";
import {
  importedGamePath,
  learningLinePath,
  repertoireMovePath,
  trainingLinePath,
} from "@/lib/routes";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { ensureTrainingSession } from "@/mutations/trainingSession";
import { trainingLineScheduleKey } from "@/mutations/learningSession";
import { useState } from "@/app/AppStateProvider";
import { useRedirectMissingRepertoireRoute } from "@/app/routeRedirects";
import { trainingMistakeLinkKey, useTrainingMistakeLinks } from "@/lib/useTrainingMistakeLinks";

export function TrainingLines(props: {
  repertoireHandle: string;
  chapterHandle: string;
  missingLine: boolean;
}) {
  const state = useState();
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );

  const chapterPgn = useSelector(getChapterPgn);
  const orientation = useSelector(selectOrientation);
  const trainingSession = useSelector((state) => state.training.session);
  const reviews = useSelector((state) => state.training.reviews);
  const onEnsureTrainingSession = useMutation(ensureTrainingSession);
  const [now, setNow] = createSignal(Date.now());
  const mistakeLinks = useTrainingMistakeLinks();

  const reviewKey = (uciPath: string) =>
    trainingLineScheduleKey(
      state,
      {
        type: "variation-training",
        repertoireHandle: props.repertoireHandle,
        chapterHandle: props.chapterHandle,
      },
      uciPath,
    );
  const sourceLines = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn === null) return [];
    const scheduledPaths = Object.entries(reviews())
      .filter(([key, review]) => key === reviewKey(review.uciPath))
      .map(([, review]) => review.uciPath);
    return getTrainingLinesWithScheduledPaths(pgn, orientation(), scheduledPaths);
  });
  const reviewForLine = (uciPath: string) => {
    const key = reviewKey(uciPath);
    return key === null ? undefined : reviews()[key];
  };
  const lines = createMemo(() =>
    prioritizeDueTrainingLines(
      sourceLines(),
      Object.fromEntries(sourceLines().map((line) => [line.id, reviewForLine(line.uciPath)])),
      now(),
    ),
  );
  const lineIds = createMemo(() => lines().map((line) => line.id));
  const results = createMemo(
    () => new Map(trainingSession()?.results.map((result) => [result.lineId, result]) ?? []),
  );
  const isLineLearned = (uciPath: string) => reviewForLine(uciPath) !== undefined;
  const isLineDue = (uciPath: string) => isTrainingReviewDue(reviewForLine(uciPath), now());
  const firstDueLine = createMemo(() =>
    lines().find((line) => isLineLearned(line.uciPath) && isLineDue(line.uciPath)),
  );

  let dueTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    () => ({ now: now(), dueTimes: Object.values(reviews()).map((review) => review.dueAt) }),
    ({ dueTimes }) => {
      if (dueTimer !== undefined) clearTimeout(dueTimer);
      const currentTime = Date.now();
      const nextDueAt = dueTimes.filter((dueAt) => dueAt > currentTime).sort((a, b) => a - b)[0];
      if (nextDueAt === undefined) return;
      dueTimer = setTimeout(
        () => setNow(Date.now()),
        Math.min(nextDueAt - currentTime + 1, 2_147_483_647),
      );
    },
  );
  onCleanup(() => {
    if (dueTimer !== undefined) clearTimeout(dueTimer);
  });

  createEffect(
    () => lineIds(),
    (ids) => onEnsureTrainingSession(ids),
  );

  function lineLabel(terminalMoveId: number): string {
    const pgn = chapterPgn();
    if (pgn === null) return "";
    return getVariationMoveIds(pgn, terminalMoveId)
      .map((moveId) => pgn.moves[moveId]?.san)
      .filter((san) => san !== undefined)
      .join(" ");
  }

  function linePositionKey(terminalMoveId: number): string {
    const pgn = chapterPgn();
    return pgn === null ? "" : (movePositionKey(pgn, terminalMoveId) ?? "");
  }

  const listItems = createMemo<TrainingLineListItem[]>(() =>
    lines().map((line) => {
      const result = results().get(line.id);
      const review = reviewForLine(line.uciPath);
      const isLearned = review !== undefined;
      const isDue = isLineDue(line.uciPath);
      const mistakeLink =
        mistakeLinks()[trainingMistakeLinkKey(review?.chapterId ?? "", line.uciPath)];
      const learningHref = learningLinePath(props.repertoireHandle, props.chapterHandle, line.id);
      return {
        id: line.id,
        label: lineLabel(line.terminalMoveId),
        intervalIndex: review?.intervalIndex,
        isAlternative: line.isAlternative,
        isLearned,
        dueAt: review?.dueAt,
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
          props.repertoireHandle,
          props.chapterHandle,
          linePositionKey(line.terminalMoveId),
        ),
        primaryHref: isLearned
          ? trainingLinePath(props.repertoireHandle, props.chapterHandle, line.id)
          : learningHref,
        trainingStatus: isDue ? "due" : result === undefined ? "untrained" : "trained",
      };
    }),
  );

  return (
    <FullWidthLayout
      title={<RepertoireBreadcrumb showTraining trainingLineId={null} />}
      reserveRightSlot
      showMobileHeaderDivider
    >
      <div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-lg font-medium">Lines</h1>
            <div class="text-sm text-muted-foreground">
              {results().size}/{lines().length} trained
            </div>
          </div>
          <Show when={firstDueLine()}>
            {(line) => (
              <Button
                size="sm"
                href={trainingLinePath(props.repertoireHandle, props.chapterHandle, line().id)}
              >
                Train all
              </Button>
            )}
          </Show>
        </div>

        <Show when={props.missingLine}>
          <div class="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm">
            This line no longer exists in the chapter.
          </div>
        </Show>

        <TrainingLineList
          lines={listItems()}
          emptyMessage="Nothing to train"
          loading={false}
          now={now()}
        />
      </div>
    </FullWidthLayout>
  );
}

export default function TrainingLinesRoute() {
  const params = useParams<{ repertoireHandle: string; chapterHandle: string }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  return (
    <TrainingLines
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
      missingLine={false}
    />
  );
}

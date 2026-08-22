import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import type { TrainingLineListItem } from "@/components/TrainingLineList";
import {
  TrainingQueueList,
  type TrainingQueueRepertoireGroup,
} from "@/components/TrainingQueueList";
import { TrainingReviewButton } from "@/components/TrainingReviewButton";
import { findOpening, getScheduledTrainingLines, movePositionKey } from "@/lib/AppState";
import {
  importedGamePath,
  lineReaderPath,
  repertoireMovePath,
  trainingLinePath,
  trainingLineReviewPath,
  trainingQueuePath,
} from "@/lib/routes";
import { useLoadPgns } from "@/lib/useLoadPgn";
import { useLoadRepertoiresAndChapters } from "@/lib/useLoadRepertoiresAndChapters";
import { useMutation } from "@/lib/useMutation";
import { useOpeningIndex } from "@/lib/useOpeningIndex";
import { trainingMistakeLinkKey, useTrainingMistakeLinks } from "@/lib/useTrainingMistakeLinks";
import { ensureTrainingQueueReview } from "@/mutations/trainingSession";

type TrainingQueueEntry = {
  repertoireId: string;
  repertoireName: string;
  chapterId: string;
  chapterName: string;
  line: TrainingLineListItem;
};

type MutableTrainingQueueChapterGroup = {
  id: string;
  name: string;
  lines: TrainingLineListItem[];
};

type MutableTrainingQueueRepertoireGroup = {
  id: string;
  name: string;
  chapters: MutableTrainingQueueChapterGroup[];
};

function compareNamedIds(
  left: { id: string; name: string },
  right: { id: string; name: string },
): number {
  const byName = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

function groupTrainingQueueEntries(
  entries: readonly TrainingQueueEntry[],
): TrainingQueueRepertoireGroup[] {
  const groups = new Map<string, MutableTrainingQueueRepertoireGroup>();

  for (const entry of entries) {
    let repertoire = groups.get(entry.repertoireId);
    if (repertoire === undefined) {
      repertoire = { id: entry.repertoireId, name: entry.repertoireName, chapters: [] };
      groups.set(entry.repertoireId, repertoire);
    }

    let chapter = repertoire.chapters.find((candidate) => candidate.id === entry.chapterId);
    if (chapter === undefined) {
      chapter = { id: entry.chapterId, name: entry.chapterName, lines: [] };
      repertoire.chapters.push(chapter);
    }
    chapter.lines.push(entry.line);
  }

  return [...groups.values()].sort(compareNamedIds).map((repertoire) => ({
    ...repertoire,
    chapters: [...repertoire.chapters].sort(compareNamedIds),
  }));
}

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
  const openingIndex = useOpeningIndex();

  const scheduledPgnIds = createMemo(() => {
    if (state.chapters.status !== "success") return [];
    const chapterById = state.chapters.data;
    return Object.values(state.training.reviews)
      .map((review) => chapterById[review.chapterId]?.pgnId)
      .filter((pgnId) => pgnId !== undefined);
  });
  useLoadPgns(() => scheduledPgnIds());

  const isLoading = createMemo(() => {
    if (openingIndex().status === "loading") return true;
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
  const listEntries = createMemo<TrainingQueueEntry[]>(() =>
    lines().map((line) => {
      const mistakeLink =
        mistakeLinks()[trainingMistakeLinkKey(line.chapter.id, line.line.uciPath)];
      const pgn = loadedPgns()[line.chapter.pgnId];
      const selectedPositionKey =
        pgn === undefined ? "" : (movePositionKey(pgn, line.line.terminalMoveId) ?? "");
      const openings = openingIndex();
      return {
        repertoireId: line.repertoire.id,
        repertoireName: line.repertoire.name,
        chapterId: line.chapter.id,
        chapterName: line.chapter.name,
        line: {
          id: line.line.id,
          label: line.label,
          opening:
            pgn === undefined || openings.status === "loading"
              ? undefined
              : findOpening(pgn, line.line.terminalMoveId, openings.data),
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
          readHref: lineReaderPath(line.repertoire.handle, line.chapter.handle, line.line.id),
          viewHref: repertoireMovePath(
            line.repertoire.handle,
            line.chapter.handle,
            selectedPositionKey,
          ),
          primaryHref: trainingLinePath(line.repertoire.handle, line.chapter.handle, line.line.id),
          queueKey: line.key,
          trainingStatus: line.isDue ? "due" : "trained",
        },
      };
    }),
  );
  const queueGroups = createMemo<TrainingQueueRepertoireGroup[]>(() =>
    groupTrainingQueueEntries(listEntries()),
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

        <TrainingQueueList
          groups={queueGroups()}
          loading={isLoading()}
          now={now()}
          emptyMessage="No lines are scheduled yet. Learn a repertoire line to add it here."
        />
      </div>
    </FullWidthLayout>
  );
}

export default Training;

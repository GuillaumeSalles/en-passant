import { A } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { Ellipsis } from "@/components/Icons";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import {
  getChapterPgn,
  getTrainingLines,
  getVariationMoveIds,
  isTrainingReviewDue,
  prioritizeDueTrainingLines,
  selectOrientation,
} from "@/lib/AppState";
import { learningLinePath, repertoireMovePath, trainingLinePath } from "@/lib/routes";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { ensureTrainingSession } from "@/mutations/trainingSession";
import { learningLineKey } from "@/mutations/learningSession";

export function TrainingLines(props: {
  repertoireHandle: string;
  chapterHandle: string;
  missingLine: boolean;
}) {
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

  const sourceLines = createMemo(() => {
    const pgn = chapterPgn();
    return pgn === null ? [] : getTrainingLines(pgn, orientation());
  });
  const reviewKey = (lineId: string) =>
    learningLineKey(
      {
        type: "variation-training",
        repertoireHandle: props.repertoireHandle,
        chapterHandle: props.chapterHandle,
      },
      lineId,
    );
  const reviewForLine = (lineId: string) => reviews()[reviewKey(lineId)];
  const lines = createMemo(() =>
    prioritizeDueTrainingLines(
      sourceLines(),
      Object.fromEntries(sourceLines().map((line) => [line.id, reviewForLine(line.id)])),
      now(),
    ),
  );
  const lineIds = createMemo(() => lines().map((line) => line.id));
  const results = createMemo(
    () => new Map(trainingSession()?.results.map((result) => [result.lineId, result]) ?? []),
  );
  const learnedLineKeys = useSelector((state) => state.learning.learnedLineKeys);
  const learnedLines = createMemo(
    () =>
      new Set(
        learnedLineKeys().filter((key) =>
          key.startsWith(`${props.repertoireHandle}/${props.chapterHandle}/`),
        ),
      ),
  );
  const isLineLearned = (lineId: string) => learnedLines().has(reviewKey(lineId));
  const isLineDue = (lineId: string) => isTrainingReviewDue(reviewForLine(lineId), now());
  const firstDueLine = createMemo(() =>
    lines().find((line) => isLineLearned(line.id) && isLineDue(line.id)),
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

  return (
    <FullWidthLayout
      title={<RepertoireBreadcrumb showTraining trainingLineId={null} />}
      reserveRightSlot
      showMobileHeaderDivider={false}
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

        <div class="mt-4 overflow-hidden rounded-md border border-border bg-background">
          <For
            each={lines()}
            fallback={<div class="p-3 text-sm text-muted-foreground">Nothing to train</div>}
          >
            {(line, index) => {
              const result = () => results().get(line.id);
              const isLearned = () => isLineLearned(line.id);
              const isDue = () => isLineDue(line.id);
              return (
                <>
                  <Show when={index() > 0}>
                    <HorizontalDashedDivider animation="none" />
                  </Show>
                  <div
                    class="flex min-w-0 items-center justify-between gap-3 p-3"
                    data-training-line={line.id}
                    data-training-status={
                      isDue() ? "due" : result() === undefined ? "untrained" : "trained"
                    }
                    data-learning-status={isLearned() ? "learned" : "unlearned"}
                    data-alternative-line={line.isAlternative ? "true" : "false"}
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">Line {index() + 1}</span>
                        <Show when={line.isAlternative}>
                          <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            Alternative
                          </span>
                        </Show>
                        <Show when={isDue()}>
                          <span class="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
                            Due
                          </span>
                        </Show>
                      </div>
                      <div class="mt-1 truncate text-sm text-muted-foreground">
                        {lineLabel(line.terminalMoveId)}
                      </div>
                    </div>
                    <div class="flex flex-none items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        href={repertoireMovePath(
                          props.repertoireHandle,
                          props.chapterHandle,
                          line.terminalMoveId,
                        )}
                      >
                        View
                      </Button>
                      <Show
                        when={isLearned()}
                        fallback={
                          <Button
                            size="sm"
                            href={learningLinePath(
                              props.repertoireHandle,
                              props.chapterHandle,
                              line.id,
                            )}
                          >
                            Learn
                          </Button>
                        }
                      >
                        <Button
                          size="sm"
                          href={trainingLinePath(
                            props.repertoireHandle,
                            props.chapterHandle,
                            line.id,
                          )}
                        >
                          Train
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button
                              size="sm-icon"
                              variant="outline"
                              aria-label={`More actions for line ${index() + 1}`}
                            >
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <A
                                class="w-full"
                                href={learningLinePath(
                                  props.repertoireHandle,
                                  props.chapterHandle,
                                  line.id,
                                )}
                              >
                                Learn again
                              </A>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Show>
                    </div>
                  </div>
                </>
              );
            }}
          </For>
        </div>
      </div>
    </FullWidthLayout>
  );
}

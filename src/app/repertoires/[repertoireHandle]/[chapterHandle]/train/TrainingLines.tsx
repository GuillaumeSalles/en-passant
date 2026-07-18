import { createEffect, createMemo, For, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { Check } from "@/components/Icons";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { Button } from "@/components/ui/button";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { getChapterPgn, getTrainingLines, getVariationMoveIds } from "@/lib/AppState";
import { learningLinePath, trainingLinePath } from "@/lib/routes";
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
  const trainingSession = useSelector((state) => state.training.session);
  const onEnsureTrainingSession = useMutation(ensureTrainingSession);

  const lines = createMemo(() => {
    const pgn = chapterPgn();
    return pgn === null ? [] : getTrainingLines(pgn);
  });
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
  const firstUntrainedLine = createMemo(() => lines().find((line) => !results().has(line.id)));

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
          <Show when={firstUntrainedLine()}>
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
              const isLearned = () =>
                learnedLines().has(
                  learningLineKey(
                    {
                      type: "variation-training",
                      repertoireHandle: props.repertoireHandle,
                      chapterHandle: props.chapterHandle,
                    },
                    line.id,
                  ),
                );
              return (
                <>
                  <Show when={index() > 0}>
                    <HorizontalDashedDivider animation="none" />
                  </Show>
                  <div
                    class="flex min-w-0 items-center justify-between gap-3 p-3"
                    data-training-line={line.id}
                    data-training-status={result() === undefined ? "untrained" : "trained"}
                    data-learning-status={isLearned() ? "learned" : "unlearned"}
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">Line {index() + 1}</span>
                        <Show when={result()}>
                          {(trainedResult) => (
                            <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check size={14} />
                              {trainedResult().mistakeCount === 0
                                ? "Trained"
                                : `Trained with ${trainedResult().mistakeCount} mistake${trainedResult().mistakeCount === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </Show>
                        <Show when={isLearned()}>
                          <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Check size={14} />
                            Learned
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
                        href={learningLinePath(
                          props.repertoireHandle,
                          props.chapterHandle,
                          line.id,
                        )}
                      >
                        {isLearned() ? "Learn again" : "Learn"}
                      </Button>
                      <Button
                        size="sm"
                        variant={result() === undefined ? "default" : "outline"}
                        href={trainingLinePath(
                          props.repertoireHandle,
                          props.chapterHandle,
                          line.id,
                        )}
                      >
                        {result() === undefined ? "Train" : "Train again"}
                      </Button>
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

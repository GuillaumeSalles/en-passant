import { A } from "@solidjs/router";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { TrainingMasteryBadge } from "@/components/TrainingMasteryBadge";
import { Button } from "@/components/ui/button";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { getScheduledTrainingLines } from "@/lib/AppState";
import { trainingLinePath, trainingPath } from "@/lib/routes";
import { useLoadPgns } from "@/lib/useLoadPgn";
import { useLoadRepertoiresAndChapters } from "@/lib/useLoadRepertoiresAndChapters";

function formatDueTime(dueAt: number, now: number): string {
  const difference = dueAt - now;
  const absoluteDifference = Math.abs(difference);
  if (absoluteDifference < 60_000) return difference <= 0 ? "Due now" : "Due in less than a minute";

  const units = [
    { milliseconds: 24 * 60 * 60 * 1000, label: "day" },
    { milliseconds: 60 * 60 * 1000, label: "hour" },
    { milliseconds: 60 * 1000, label: "minute" },
  ] as const;
  const unit = units.find((candidate) => absoluteDifference >= candidate.milliseconds) ?? units[2];
  const amount = Math.floor(absoluteDifference / unit.milliseconds);
  const duration = `${amount} ${unit.label}${amount === 1 ? "" : "s"}`;
  return difference <= 0 ? `Due ${duration} ago` : `Due in ${duration}`;
}

export function Training() {
  const state = useState();
  const [now, setNow] = createSignal(Date.now());
  const clock = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clock));

  useLoadRepertoiresAndChapters();

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
  const lines = createMemo(() => {
    if (state.repertoires.status !== "success" || state.chapters.status !== "success") return [];
    const pgns = Object.fromEntries(
      Object.entries(state.pgns).flatMap(([pgnId, result]) =>
        result.status === "success" ? [[pgnId, result.data]] : [],
      ),
    );
    return getScheduledTrainingLines(
      state.repertoires.data,
      state.chapters.data,
      pgns,
      state.training.reviews,
      now(),
    );
  });
  const dueCount = createMemo(() => lines().filter((line) => line.isDue).length);

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
          <Show when={lines()[0]}>
            {(line) => (
              <Button
                size="sm"
                href={trainingLinePath(
                  line().repertoire.handle,
                  line().chapter.handle,
                  line().line.id,
                )}
              >
                Train next
              </Button>
            )}
          </Show>
        </div>

        <div class="mt-4 overflow-hidden rounded-md border border-border bg-background">
          <Show
            when={!isLoading()}
            fallback={<div class="p-4 text-sm text-muted-foreground">Loading training lines…</div>}
          >
            <For
              each={lines()}
              fallback={
                <div class="p-4 text-sm text-muted-foreground">
                  No lines are scheduled yet. Learn a repertoire line to add it here.
                </div>
              }
            >
              {(line, index) => (
                <>
                  <Show when={index() > 0}>
                    <HorizontalDashedDivider animation="none" />
                  </Show>
                  <div
                    class="flex min-w-0 items-center justify-between gap-3 p-3"
                    data-training-queue-line={line.key}
                  >
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-medium text-muted-foreground">
                          Priority {index() + 1}
                        </span>
                        <TrainingMasteryBadge intervalIndex={line.review.intervalIndex} />
                        <span
                          class={
                            line.isDue
                              ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                              : "text-xs text-muted-foreground"
                          }
                          title={new Date(line.review.dueAt).toLocaleString()}
                        >
                          {formatDueTime(line.review.dueAt, now())}
                        </span>
                      </div>
                      <div class="mt-1 truncate text-sm font-medium">{line.label}</div>
                      <div class="mt-0.5 truncate text-xs text-muted-foreground">
                        <A
                          class="underline-offset-4 hover:text-foreground hover:underline"
                          href={trainingPath(line.repertoire.handle, line.chapter.handle)}
                        >
                          {line.repertoire.name} · {line.chapter.name}
                        </A>
                      </div>
                    </div>
                    <Button
                      class="flex-none"
                      size="sm"
                      href={trainingLinePath(
                        line.repertoire.handle,
                        line.chapter.handle,
                        line.line.id,
                      )}
                    >
                      Train
                    </Button>
                  </div>
                </>
              )}
            </For>
          </Show>
        </div>
      </div>
    </FullWidthLayout>
  );
}

export default Training;

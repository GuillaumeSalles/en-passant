import { For, Show } from "solid-js";
import { TrainingMasteryBadge } from "@/components/TrainingMasteryBadge";
import { Button } from "@/components/ui/button";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";

type TrainingLineLink = {
  href: string;
  label: string;
};

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

export type TrainingLineListItem = {
  id: string;
  label: string;
  repertoire: TrainingLineLink;
  chapter: TrainingLineLink;
  intervalIndex: number | undefined;
  isAlternative: boolean;
  isLearned: boolean;
  dueAt?: number | undefined;
  detailLinks?: readonly TrainingLineLink[] | undefined;
  primaryHref: string;
  viewHref: string;
  queueKey?: string | undefined;
  trainingStatus: "due" | "trained" | "untrained";
};

export function TrainingLineList(props: {
  lines: readonly TrainingLineListItem[];
  emptyMessage: string;
  loading: boolean;
  now: number;
  loadingMessage?: string;
}) {
  return (
    <div class="mt-4 overflow-hidden rounded-md border border-border bg-background">
      <Show
        when={!props.loading}
        fallback={
          <div class="p-4 text-sm text-muted-foreground">
            {props.loadingMessage ?? "Loading training lines…"}
          </div>
        }
      >
        <For
          each={props.lines}
          fallback={<div class="p-3 text-sm text-muted-foreground">{props.emptyMessage}</div>}
        >
          {(line, index) => (
            <>
              <Show when={index() > 0}>
                <HorizontalDashedDivider animation="none" />
              </Show>
              <div
                class="flex min-w-0 items-center justify-between gap-3 p-3"
                data-training-line={line.id}
                data-training-queue-line={line.queueKey}
                data-training-status={line.trainingStatus}
                data-learning-status={line.isLearned ? "learned" : "unlearned"}
                data-alternative-line={line.isAlternative ? "true" : "false"}
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <div class="flex min-w-0 flex-none items-baseline gap-1 text-xs text-muted-foreground">
                      <a
                        class="max-w-40 truncate underline-offset-4 hover:text-foreground hover:underline"
                        href={line.repertoire.href}
                      >
                        {line.repertoire.label}
                      </a>
                      <span>·</span>
                      <a
                        class="max-w-40 truncate underline-offset-4 hover:text-foreground hover:underline"
                        href={line.chapter.href}
                      >
                        {line.chapter.label}
                      </a>
                    </div>
                    <div class="min-w-48 flex-1 font-medium">{line.label}</div>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <TrainingMasteryBadge intervalIndex={line.intervalIndex} />
                    <Show when={line.isAlternative}>
                      <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Alternative
                      </span>
                    </Show>
                    <Show when={line.dueAt !== undefined}>
                      <span
                        class={
                          line.trainingStatus === "due"
                            ? "inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400"
                            : "inline-flex items-center text-xs text-muted-foreground"
                        }
                        title={new Date(line.dueAt ?? props.now).toLocaleString()}
                      >
                        {formatDueTime(line.dueAt ?? props.now, props.now)}
                      </span>
                    </Show>
                  </div>
                  <Show when={line.detailLinks !== undefined && line.detailLinks.length > 0}>
                    <div class="mt-0.5 truncate text-xs text-muted-foreground">
                      <For each={line.detailLinks}>
                        {(link, linkIndex) => (
                          <>
                            <Show when={linkIndex() > 0}>{" · "}</Show>
                            <a
                              class="underline-offset-4 hover:text-foreground hover:underline"
                              href={link.href}
                            >
                              {link.label}
                            </a>
                          </>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
                <div class="flex flex-none items-center gap-2">
                  <Button size="sm" variant="outline" href={line.viewHref}>
                    View
                  </Button>
                  <Button size="sm" href={line.primaryHref}>
                    {line.isLearned ? "Review" : "Learn"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </For>
      </Show>
    </div>
  );
}

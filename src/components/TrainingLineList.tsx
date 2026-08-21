import { For, Show } from "solid-js";
import { Ellipsis } from "@/components/Icons";
import { TrainingMasteryBadge } from "@/components/TrainingMasteryBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { cn } from "@/lib/utils";

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
  intervalIndex: number | undefined;
  isAlternative: boolean;
  isLearned: boolean;
  dueAt?: number | undefined;
  detailLinks?: readonly TrainingLineLink[] | undefined;
  primaryHref: string;
  readHref: string;
  viewHref: string;
  queueKey?: string | undefined;
  trainingStatus: "due" | "trained" | "untrained";
};

function isOverstudy(line: TrainingLineListItem, now: number): boolean {
  return line.isLearned && line.dueAt !== undefined && line.dueAt > now;
}

function trainingActionLabel(line: TrainingLineListItem, now: number): string {
  if (!line.isLearned) return "Learn";
  return isOverstudy(line, now) ? "Overstudy" : "Review";
}

const TRAINING_LINE_SKELETONS = [
  { labelWidth: "w-40", detailWidth: "w-24" },
  { labelWidth: "w-52", detailWidth: "w-32" },
  { labelWidth: "w-32", detailWidth: "w-20" },
] as const;

function TrainingLineListSkeleton(props: { message: string }) {
  return (
    <div role="status" aria-label={props.message}>
      <span class="sr-only">{props.message}</span>
      <For each={TRAINING_LINE_SKELETONS}>
        {(skeleton, index) => (
          <>
            <Show when={index() > 0}>
              <HorizontalDashedDivider animation="none" />
            </Show>
            <div
              class="flex min-w-0 items-center justify-between gap-3 p-3"
              data-training-line-skeleton
              aria-hidden="true"
            >
              <div class="min-w-0 flex-1">
                <div
                  class={`h-4 max-w-full animate-pulse rounded-sm bg-muted/60 motion-reduce:animate-none ${skeleton.labelWidth}`}
                />
                <div class="mt-2 flex items-center gap-2">
                  <div class="h-5 w-16 animate-pulse rounded-full bg-muted/50 motion-reduce:animate-none" />
                  <div
                    class={`h-3 max-w-full animate-pulse rounded-sm bg-muted/40 motion-reduce:animate-none ${skeleton.detailWidth}`}
                  />
                </div>
              </div>
              <div class="flex flex-none items-center gap-2">
                <div class="h-8 w-8 animate-pulse rounded-md bg-muted/50 motion-reduce:animate-none" />
                <div class="h-8 w-16 animate-pulse rounded-md bg-muted/60 motion-reduce:animate-none" />
              </div>
            </div>
          </>
        )}
      </For>
    </div>
  );
}

export function TrainingLineList(props: {
  class?: string;
  lines: readonly TrainingLineListItem[];
  emptyMessage: string;
  loading: boolean;
  now: number;
  loadingMessage?: string;
}) {
  return (
    <div
      class={cn("mt-4 overflow-hidden rounded-md border border-border bg-background", props.class)}
    >
      <Show
        when={!props.loading}
        fallback={
          <TrainingLineListSkeleton message={props.loadingMessage ?? "Loading training lines…"} />
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
                  <div class="text-sm font-medium text-foreground">{line.label}</div>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <TrainingMasteryBadge intervalIndex={line.intervalIndex} />
                    <Show when={line.isAlternative}>
                      <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Alternative
                      </span>
                    </Show>
                    <Show when={line.dueAt !== undefined}>
                      <span
                        class="inline-flex items-center text-xs text-muted-foreground"
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
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Actions for ${line.label}`}
                      >
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={false} href={line.readHref}>
                        Read line
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={false} href={line.viewHref}>
                        View in chapter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant={isOverstudy(line, props.now) ? "outline" : "default"}
                    href={line.primaryHref}
                  >
                    {trainingActionLabel(line, props.now)}
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

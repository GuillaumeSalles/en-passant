import { For, Show } from "solid-js";
import { TrainingLineList, type TrainingLineListItem } from "./TrainingLineList";

export type TrainingQueueChapterGroup = {
  id: string;
  name: string;
  lines: readonly TrainingLineListItem[];
};

export type TrainingQueueRepertoireGroup = {
  id: string;
  name: string;
  chapters: readonly TrainingQueueChapterGroup[];
};

export function TrainingQueueList(props: {
  groups: readonly TrainingQueueRepertoireGroup[];
  emptyMessage: string;
  loading: boolean;
  now: number;
}) {
  return (
    <Show
      when={!props.loading && props.groups.length > 0}
      fallback={
        <TrainingLineList
          lines={[]}
          emptyMessage={props.emptyMessage}
          loading={props.loading}
          now={props.now}
        />
      }
    >
      <div class="mt-5 flex flex-col gap-6">
        <For each={props.groups}>
          {(repertoire) => (
            <section
              aria-labelledby={`training-repertoire-${repertoire.id}`}
              data-training-repertoire-group={repertoire.id}
            >
              <h3
                id={`training-repertoire-${repertoire.id}`}
                class="truncate text-base font-medium text-foreground"
              >
                {repertoire.name}
              </h3>
              <div class="mt-3 flex flex-col gap-4">
                <For each={repertoire.chapters}>
                  {(chapter) => (
                    <section
                      aria-labelledby={`training-chapter-${chapter.id}`}
                      data-training-chapter-group={chapter.id}
                    >
                      <h4
                        id={`training-chapter-${chapter.id}`}
                        class="truncate text-sm font-medium text-muted-foreground"
                      >
                        {chapter.name}
                      </h4>
                      <TrainingLineList
                        class="mt-2"
                        lines={chapter.lines}
                        emptyMessage={props.emptyMessage}
                        loading={false}
                        now={props.now}
                      />
                    </section>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>
    </Show>
  );
}

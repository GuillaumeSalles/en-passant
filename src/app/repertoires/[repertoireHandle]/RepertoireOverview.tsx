import { createMemo, For, Show } from "solid-js";
import { MobileNavigationTrigger } from "@/components/MobileNavigation";
import { Brain, Download, Pencil, Plus, Trash } from "@/components/Icons";
import { Button } from "@/components/ui/button";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import type { Chapter } from "@/lib/AppState";
import { repertoirePath, trainingPath } from "@/lib/routes";
import { useLoadRepertoiresAndChapters } from "@/lib/useLoadRepertoiresAndChapters";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { createNewChapter } from "@/mutations/createNewChapter";
import { deleteChapter } from "@/app/Repertoires";
import { useState } from "@/app/AppStateProvider";
import { exportChapterPgn } from "@/lib/exportPgn";

function compareChapters(left: Chapter, right: Chapter): number {
  const byName = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

export function RepertoireOverview(props: { repertoireHandle: string }) {
  const state = useState();

  useLoadRepertoiresAndChapters();

  const repertoires = useSelector((state) => state.repertoires);
  const chapters = useSelector((state) => state.chapters);
  const onCreateNewChapter = useMutation(createNewChapter, { context: true });
  const onDeleteChapter = useMutation(deleteChapter, { context: true });

  const repertoire = createMemo(() => {
    const result = repertoires();
    if (result.status !== "success") return undefined;
    return Object.values(result.data).find(
      (candidate) => candidate.handle === props.repertoireHandle,
    );
  });

  const repertoireChapters = createMemo(() => {
    const currentRepertoire = repertoire();
    const result = chapters();
    if (currentRepertoire === undefined || result.status !== "success") return [];
    return Object.values(result.data)
      .filter((chapter) => chapter.repertoireId === currentRepertoire.id)
      .sort(compareChapters);
  });

  function createChapter() {
    const currentRepertoire = repertoire();
    if (currentRepertoire === undefined) return;
    return onCreateNewChapter({ repertoireId: currentRepertoire.id });
  }

  function exportChapter(chapter: Chapter): void {
    const currentRepertoire = repertoire();
    if (currentRepertoire === undefined) return;
    void exportChapterPgn({ state, repertoire: currentRepertoire, chapter });
  }

  return (
    <div class="flex h-full min-w-0 flex-1 flex-col">
      <div class="flex h-[3.25rem] flex-shrink-0 flex-row">
        <div class="flex min-w-0 flex-1 items-center gap-2 pl-4 pr-4">
          <MobileNavigationTrigger class="flex-none" />
          <Show when={repertoire()}>
            {(currentRepertoire) => (
              <div class="min-w-0 truncate text-base font-medium">{currentRepertoire().name}</div>
            )}
          </Show>
        </div>
        <div class="hidden w-[400px] min-w-[400px] max-w-[400px] flex-none xl:block" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <h1 class="truncate text-lg font-medium">Chapters</h1>
            <Button aria-label="Create chapter" onClick={createChapter}>
              <Plus />
              Chapter
            </Button>
          </div>
          <div class="mt-4 overflow-hidden rounded-md border border-border bg-background">
            <For each={repertoireChapters()}>
              {(chapter, index) => (
                <>
                  <Show when={index() > 0}>
                    <HorizontalDashedDivider animation="none" />
                  </Show>
                  <div class="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                      <div class="truncate font-medium">{chapter.name}</div>
                    </div>
                    <div class="flex flex-none flex-wrap items-center gap-2">
                      <Button href={trainingPath(props.repertoireHandle, chapter.handle)} size="sm">
                        <Brain />
                        Train
                      </Button>
                      <Button
                        href={repertoirePath(props.repertoireHandle, chapter.handle)}
                        variant="outline"
                        size="sm"
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportChapter(chapter)}>
                        <Download />
                        Export PGN
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={repertoireChapters().length <= 1}
                        onClick={() =>
                          onDeleteChapter({ chapterId: chapter.id, pgnId: chapter.pgnId })
                        }
                      >
                        <Trash />
                        Delete
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

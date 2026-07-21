import { createMemo, For, Show } from "solid-js";
import { FullWidthLayout } from "@/components/FullWidthLayout";
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
import { MAX_CHAPTERS_PER_REPERTOIRE } from "@/lib/repertoireLimits";

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
    <FullWidthLayout
      title={
        <Show when={repertoire()}>
          {(currentRepertoire) => (
            <div class="min-w-0 truncate text-base font-medium">{currentRepertoire().name}</div>
          )}
        </Show>
      }
      reserveRightSlot
      showMobileHeaderDivider={false}
    >
      <div class="mx-auto flex w-full max-w-5xl flex-col px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <h1 class="truncate text-lg font-medium">Chapters</h1>
          <Button
            aria-label="Create chapter"
            onClick={createChapter}
            disabled={repertoireChapters().length >= MAX_CHAPTERS_PER_REPERTOIRE}
            title={
              repertoireChapters().length >= MAX_CHAPTERS_PER_REPERTOIRE
                ? `Maximum of ${MAX_CHAPTERS_PER_REPERTOIRE} chapters reached`
                : undefined
            }
          >
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
    </FullWidthLayout>
  );
}

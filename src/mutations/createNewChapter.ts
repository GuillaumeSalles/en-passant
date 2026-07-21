import { Chapter, emptyNormalizedPgn, normalizePgn, toPgn } from "@/lib/AppState";
import { uniqueHandle } from "@/lib/handles";
import { repertoirePath } from "@/lib/routes";
import { MutationContext } from "@/lib/useMutation";
import { queueRepertoireSync } from "@/storage/backendSync";
import { MAX_CHAPTERS_PER_REPERTOIRE } from "@/lib/repertoireLimits";

export async function createNewChapter(
  { store, router, storage: { createChapter } }: MutationContext,
  { repertoireId, pgn: initialPgn }: { repertoireId: string; pgn?: string },
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success" || state.chapters.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  const repertoire = state.repertoires.data[repertoireId];
  if (repertoire === undefined) {
    return;
  }

  const chapterId = crypto.randomUUID();
  const repertoireChapters = Object.values(state.chapters.data).filter(
    (chapter) => chapter.repertoireId === repertoireId,
  );
  if (repertoireChapters.length >= MAX_CHAPTERS_PER_REPERTOIRE) {
    return;
  }
  const chapterCount = repertoireChapters.length;
  const chapterName = `Chapter ${chapterCount + 1}`;
  const chapterHandle = uniqueHandle(
    `chapter-${chapterCount + 1}`,
    repertoireChapters.map((chapter) => chapter.handle),
  );
  const pgnId = crypto.randomUUID();
  const pgn = initialPgn === undefined ? emptyNormalizedPgn() : normalizePgn(initialPgn);

  const newChapter: Chapter = {
    id: chapterId,
    repertoireId,
    handle: chapterHandle,
    name: chapterName,
    pgnId,
  };

  state.set("chapters", {
    status: "success",
    data: { ...state.chapters.data, [chapterId]: newChapter },
  });
  state.set("pgns", {
    ...state.pgns,
    [pgnId]: { status: "success", data: pgn },
  });

  router.push(repertoirePath(repertoire.handle, chapterHandle));

  await createChapter(newChapter, toPgn(pgn));
  queueRepertoireSync();
}

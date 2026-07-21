import {
  emptyNormalizedPgn,
  Chapter,
  toPgn,
  AppState,
  Repertoire,
  Orientation,
} from "@/lib/AppState";
import { handleFromName, uniqueHandle } from "@/lib/handles";
import { MutationContext } from "@/lib/useMutation";
import { queueRepertoireSync } from "@/storage/backendSync";
import { repertoirePath } from "@/lib/routes";
import { formatRepertoireName } from "@/lib/repertoireNames";
import { MAX_REPERTOIRES } from "@/lib/repertoireLimits";

export type CreateNewRepertoireInput = {
  name: string;
  orientation: Orientation;
};

function getNextValidRepertoireHandle(state: AppState, name: string): string {
  if (state.repertoires.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }

  const repertoireHandles = Object.values(state.repertoires.data).map(
    (repertoire) => repertoire.handle,
  );

  return uniqueHandle(handleFromName(name, "untitled-repertoire"), repertoireHandles);
}

export async function createNewRepertoire(
  { store, router, storage: { createRepertoireAndChapter } }: MutationContext,
  input: CreateNewRepertoireInput,
): Promise<void> {
  const state = store.state;

  if (state.repertoires.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }
  if (Object.keys(state.repertoires.data).length >= MAX_REPERTOIRES) {
    return;
  }

  const repertoireId = crypto.randomUUID();
  const repertoireName = formatRepertoireName(input.name, "Untitled Repertoire");
  const repertoireHandle = getNextValidRepertoireHandle(state, repertoireName);

  const chapterId = crypto.randomUUID();
  const chapterName = "Chapter 1";
  const chapterHandle = "chapter-1";

  const pgnId = crypto.randomUUID();
  const pgn = emptyNormalizedPgn();

  const newRepertoire: Repertoire = {
    id: repertoireId,
    handle: repertoireHandle,
    name: repertoireName,
    orientation: input.orientation,
  };

  const newChapter: Chapter = {
    id: chapterId,
    repertoireId: repertoireId,
    handle: chapterHandle,
    name: chapterName,
    pgnId,
  };

  state.set("repertoires", {
    status: "success",
    data: {
      ...state.repertoires.data,
      [repertoireId]: newRepertoire,
    },
  });
  state.set("chapters", {
    status: "success",
    data: {
      ...state.chapters.data,
      [chapterId]: newChapter,
    },
  });
  state.set("pgns", {
    ...state.pgns,
    [pgnId]: {
      status: "success",
      data: pgn,
    },
  });

  await createRepertoireAndChapter(newRepertoire, newChapter, toPgn(pgn));
  queueRepertoireSync();

  router.push(repertoirePath(repertoireHandle, chapterHandle));
}

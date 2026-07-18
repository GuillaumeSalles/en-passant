import type { Context } from "./AppState";

export const APP_ROOT = "/app";

type PathRepertoire = {
  id: string;
  handle: string;
  name: string;
};

type PathChapter = {
  id: string;
  repertoireId: string;
  handle: string;
  name: string;
};

export function repertoirePath(repertoireHandle: string, chapterHandle: string): string {
  return `${APP_ROOT}/repertoires/${repertoireHandle}/${chapterHandle}`;
}

export function repertoireOverviewPath(repertoireHandle: string): string {
  return `${APP_ROOT}/repertoires/${repertoireHandle}`;
}

export function importedGamePath(gameId: string): string {
  return `${APP_ROOT}/games/${gameId}`;
}

function compareByNameThenId(
  left: { id: string; name: string },
  right: { id: string; name: string },
): number {
  const byName = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

export function firstRepertoireChapterPath(
  repertoires: readonly PathRepertoire[],
  chapters: readonly PathChapter[],
): string | null {
  const repertoire = [...repertoires].sort(compareByNameThenId)[0];
  if (repertoire === undefined) {
    return null;
  }

  const chapter = chapters
    .filter((candidate) => candidate.repertoireId === repertoire.id)
    .sort(compareByNameThenId)[0];
  if (chapter === undefined) {
    return null;
  }

  return repertoirePath(repertoire.handle, chapter.handle);
}

export function trainingPath(repertoireHandle: string, chapterHandle: string): string {
  return `${repertoirePath(repertoireHandle, chapterHandle)}/train`;
}

export function trainingLinePath(
  repertoireHandle: string,
  chapterHandle: string,
  lineId: string,
): string {
  return `${trainingPath(repertoireHandle, chapterHandle)}/${lineId}`;
}

export function learningPath(repertoireHandle: string, chapterHandle: string): string {
  return `${repertoirePath(repertoireHandle, chapterHandle)}/learn`;
}

export function learningLinePath(
  repertoireHandle: string,
  chapterHandle: string,
  lineId: string,
): string {
  return `${learningPath(repertoireHandle, chapterHandle)}/${lineId}`;
}

export function routePath(ctx: Context, repertoireHandle: string, chapterHandle: string): string {
  if (ctx.type === "variation-training") {
    return trainingPath(repertoireHandle, chapterHandle);
  }

  return repertoirePath(repertoireHandle, chapterHandle);
}

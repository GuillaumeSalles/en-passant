import type { AppState, Chapter, Repertoire } from "@/lib/AppState";
import { toPgn } from "@/lib/AppState";
import { handleFromName } from "@/lib/handles";
import { getPgn as getStoredPgn } from "@/storage";

type ExportChapterPgnInput = {
  state: AppState;
  repertoire: Repertoire;
  chapter: Chapter;
};

function chapterPgnFilename(repertoire: Repertoire, chapter: Chapter): string {
  const repertoireHandle = handleFromName(repertoire.name, repertoire.handle);
  const chapterHandle = handleFromName(chapter.name, chapter.handle);
  return `${repertoireHandle}-${chapterHandle}.pgn`;
}

async function getChapterPgnText({
  state,
  chapter,
}: Pick<ExportChapterPgnInput, "state" | "chapter">): Promise<string> {
  const loadedPgn = state.pgns[chapter.pgnId];
  if (loadedPgn?.status === "success") {
    return toPgn(loadedPgn.data);
  }

  return (await getStoredPgn(chapter.pgnId)) ?? "";
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export async function exportChapterPgn(input: ExportChapterPgnInput): Promise<void> {
  const pgn = await getChapterPgnText(input);
  downloadTextFile(chapterPgnFilename(input.repertoire, input.chapter), pgn);
}

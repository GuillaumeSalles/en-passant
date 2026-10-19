import { deleteMove, extractMovePgn, getChapterPgn, getChapterScope, toPgn } from "@/lib/AppState";
import type { MutationContext } from "@/lib/useMutation";
import { saveLatestPgnMutation } from "@/storage/pgnPersistence";
import { createChapterAndNavigate } from "./createNewChapter";

export async function extractMoveToChapter(
  context: MutationContext,
  moveId: number,
): Promise<void> {
  const { state, route } = context;
  if (route.type !== "repertoire-builder") return;

  const scope = getChapterScope(state, route);
  const source = getChapterPgn(state, route);
  if (scope === null || source === null) return;
  const extractedPgn = extractMovePgn(source, moveId);
  if (extractedPgn === null) return;

  const originalPgn = toPgn(source);
  const chapter = await createChapterAndNavigate(context, {
    repertoireId: scope.repertoire.id,
    pgn: extractedPgn,
  });
  if (chapter === undefined) return;

  // Keep the source if it was replaced or edited while the new chapter was being saved.
  if (getChapterPgn(state, route) !== source || toPgn(source) !== originalPgn) return;

  const result = deleteMove(state, route, moveId);
  const effects = Array.isArray(result) ? result : result === undefined ? [] : [result];
  for (const effect of effects) {
    if (effect.type === "persist-pgn-mutation") {
      await saveLatestPgnMutation(effect.pgnId, effect.pgn, effect.mutation);
    }
  }
}

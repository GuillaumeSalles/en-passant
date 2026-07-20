import { savePgnMutation } from "@/storage";
import { queueRepertoireSync } from "@/storage/backendSync";
import { createPgnMutationSaveQueue } from "./pgnSaveQueue";
import type { PgnMutation } from "@/lib/AppState";

const pgnSaveQueue = createPgnMutationSaveQueue(savePgnMutation, queueRepertoireSync);

export function saveLatestPgnMutation(
  id: string,
  pgn: string,
  mutation: PgnMutation,
): Promise<void> {
  return pgnSaveQueue.savePgnMutation(id, pgn, mutation);
}

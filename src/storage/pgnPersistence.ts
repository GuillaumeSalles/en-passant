import { savePgnMutation } from "@/storage";
import { createPgnMutationSaveQueue } from "./pgnSaveQueue";
import type { PgnMutation } from "@/lib/AppState";

const pgnSaveQueue = createPgnMutationSaveQueue(savePgnMutation, () => {});

export function saveLatestPgnMutation(
  id: string,
  pgn: string,
  mutation: PgnMutation,
): Promise<void> {
  return pgnSaveQueue.savePgnMutation(id, pgn, mutation);
}

export function saveLatestPgnMutations(
  id: string,
  pgn: string,
  mutations: PgnMutation[],
): Promise<void> {
  return pgnSaveQueue.savePgnMutations(id, pgn, mutations);
}

import { savePgn } from "@/storage";
import { queueRepertoireSync } from "@/storage/backendSync";
import { createLatestPgnSaveQueue } from "./pgnSaveQueue";

const pgnSaveQueue = createLatestPgnSaveQueue(savePgn, queueRepertoireSync);

export function saveLatestPgn(id: string, pgn: string): Promise<void> {
  return pgnSaveQueue.saveLatestPgn(id, pgn);
}

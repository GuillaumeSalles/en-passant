import type { NewSerializedRepertoire, SerializedChapter } from "@/lib/AppState";

export const DEMO_REPERTOIRE_PGN = [
  "1. d4 Nf6 {Flexible London start.}",
  "(1... d5 {Build the c3-e3 base.} 2. Bf4 Nf6 3. e3 e6 4. Nf3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3 O-O 8. Bd3 b6 9. Ne5)",
  "2. Bf4 {Bishop out before e3.} e6",
  "(2... g6 {Castle first; c4 can wait.} 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. h3 c5 7. O-O)",
  "(2... d5 {Transpose to the main setup.} 3. e3 e6 4. Nf3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3 O-O 8. Bd3)",
  "3. e3 c5 {Meet ...c5 with c3.} 4. c3 d5 5. Nf3 Bd6 6. Bg3 O-O 7. Nbd2 Nc6",
  "8. Bd3 b6 9. Ne5 {Ne5 starts kingside play.} *",
].join(" ");

export type DemoRepertoireSeed = {
  repertoire: NewSerializedRepertoire;
  chapter: SerializedChapter;
  pgn: string;
};

export function createDemoRepertoireSeed(): DemoRepertoireSeed {
  const repertoireId = crypto.randomUUID();
  const pgnId = crypto.randomUUID();

  return {
    repertoire: {
      id: repertoireId,
      handle: "demo-repertoire",
      name: "Demo repertoire",
      orientation: "white",
    },
    chapter: {
      id: crypto.randomUUID(),
      repertoireId,
      handle: "london-system",
      name: "London system",
      pgnId,
    },
    pgn: DEMO_REPERTOIRE_PGN,
  };
}

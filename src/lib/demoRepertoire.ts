import type { NewSerializedRepertoire, SerializedChapter } from "@/lib/AppState";

export const DEMO_REPERTOIRE_PGN = [
  "1. d4 Nf6 {Black keeps options open, so White uses the London setup instead of chasing a specific defense.}",
  "(1... d5 {Against the classical reply, develop the bishop before e3.} 2. Bf4 Nf6 3. e3 e6 4. Nf3 c5 {Black challenges the center; c3 is usually next.})",
  "2. Bf4 {The London bishop reaches f4 before the e-pawn closes it in.} g6",
  "(2... e6 3. e3 c5 {Meet early pressure with c3 and steady development.} 4. c3 Nc6)",
  "3. e3 Bg7 4. Nf3 O-O 5. Be2 d6",
  "(5... c5 {This is the main central break to watch for.} 6. c3 d6 7. h3 Nc6)",
  "6. h3 {A quiet move that keeps pieces off g4 and prepares castling.} Nbd7 7. O-O Re8",
  "8. c4 {When Black plays a King's Indian setup, c4 takes more central space.} *",
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

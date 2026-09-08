import type { PgnMutation, TrainingLineReview } from "./app-state/types";

export type MoveSound = "Move" | "Capture";

export type MutationEffect =
  | { type: "play-sound"; sound: MoveSound }
  | { type: "record-cached-move" }
  | { type: "persist-pgn-mutation"; pgnId: string; pgn: string; mutation: PgnMutation }
  | { type: "persist-pgn-mutations"; pgnId: string; pgn: string; mutations: PgnMutation[] }
  | { type: "persist-training-line-schedule"; schedule: TrainingLineReview }
  | { type: "persist-engine-enabled"; isEnabled: boolean };

export type MutationResult = void | MutationEffect | MutationEffect[];

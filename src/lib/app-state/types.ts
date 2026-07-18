import type { StoreState } from "@/lib/createStore";
import type { AppliedMoveAnimation, FenPiece as ChessFenPiece } from "@/lib/chess";

export type Context =
  | {
      type: "repertoire-builder";
      repertoireHandle: string;
      chapterHandle: string;
    }
  | {
      type: "variation-training";
      repertoireHandle: string;
      chapterHandle: string;
    }
  | {
      type: "imported-game";
      gameId: string;
      repertoireHandle: string;
      chapterHandle: string;
    };

export type Orientation = "white" | "black";

export type SerializedChapter = {
  id: string;
  repertoireId: string;
  handle: string;
  name: string;
  pgnId: string;
};

export type NewSerializedRepertoire = {
  id: string;
  handle: string;
  name: string;
  orientation: Orientation;
};

export type SerializedRepertoire = {
  name: string;
  pgn: string;
  orientation: Orientation;
};

export type AsyncResult<T> =
  | {
      status: "not-loaded";
      data?: never;
      error?: never;
    }
  | {
      status: "loading";
      data?: never;
      error?: never;
    }
  | {
      status: "success";
      data: T;
      error?: never;
    }
  | {
      status: "error";
      data?: never;
      error: Error;
    };

export type Repertoire = {
  id: string;
  handle: string;
  name: string;
  orientation: Orientation;
};

export type Chapter = {
  id: string;
  repertoireId: string;
  handle: string;
  name: string;
  pgnId: string;
};

export type EngineSettings = {
  isEnabled: boolean;
  depth: number;
  maxTime: number;
  showLines: boolean;
  showEvalBar: boolean;
  showBestMoveArrow: boolean;
  numberOfLines: number;
};

export type MoveAnalysis = {
  id: number;
  score: NormalizedEvalScore;
};

export type Highlights = {
  squares: SquareHighlights;
  arrows: Arrows;
};

export type SquareHighlights = {
  [square: string]: HighlightKind;
};

export type Arrows = {
  [fromTo: string]: HighlightKind;
};

export type HighlightKind = "normal" | "ctrl" | "shift" | "alt";

export type ArrowKind = HighlightKind | "best-move";
export type SquareHighlightKind = HighlightKind | "last-move";
export type FenPiece = ChessFenPiece;
export type BoardAnimation = AppliedMoveAnimation & { id: number };

export type NormalizedPgn = {
  rootMoveIds: number[];
  moves: Record<number, Move>;
  moveIdCounter: number;
};

export type AppState = {
  orientation: Orientation;
  analysis: MoveAnalysis[];
  engineSettings: EngineSettings;
  evaluations: Eval[];
  selectedMoveId: number | null;
  chapterSelections: Record<
    string,
    {
      selectedMoveId: number | null;
      preselectedVariation: number | null;
    }
  >;
  repertoires: AsyncResult<Record<string, Repertoire>>;
  chapters: AsyncResult<Record<string, Chapter>>;
  pgns: Record<string, AsyncResult<NormalizedPgn>>;
  training: {
    status: TrainingState;
    variationIndex: number;
    variation: NormalizedPgn;
    session: TrainingSessionDraft | null;
  };
  learning: {
    learnedLineKeys: string[];
  };
  preselectedVariation: number | null;
  highlights: Highlights;
  animation: BoardAnimation | null;
};

export type MutableAppState = StoreState<AppState>;

export type TrainingState = "in-progress" | "alternative" | "failure" | "success" | "complete";

export type TrainingLineResult = {
  lineId: string;
  mistakeCount: number;
};

export type TrainingSessionDraft = {
  repertoireHandle: string;
  chapterHandle: string;
  lineIds: string[];
  activeLineId: string | null;
  currentMistakeCount: number;
  failedMoveIds: number[];
  replayMoveIds: number[];
  results: TrainingLineResult[];
};

export type Move = {
  id: number;
  san: string;
  nags: number[];
  fen: string;
  from: string;
  to: string;
  promotion: string | null;
  next: number[];
  prev: number | null;
  halfMoveNumber: number;
  clock: string | null;
  commentBefore: string | null;
  commentAfter: string | null;
  metadata: string[];
  timeSpent: string | null;
  timeSpentShare: number | null;
};

export type EvalMove = {
  from: string;
  to: string;
  promotion: string | null;
  san: string;
};

export type NormalizedEvalScore =
  | {
      type: "cp";
      value: number;
    }
  | {
      type: "mate-in";
      value: number;
    }
  | {
      type: "mate";
      winner: "white" | "black";
    }
  | {
      type: "stalemate";
    };

export type Eval = {
  index: number;
  depth: number;
  score: NormalizedEvalScore;
  moves: EvalMove[];
};

import { applyMove, createChessPosition } from "@/lib/chess";
import type { EngineEval, EvalScore as EngineEvalScore } from "@/lib/engine";
import { selectFen } from "./state";
import type { Context, Eval, MutableAppState, NormalizedEvalScore } from "./types";

function engineEvalToEval(evaluation: EngineEval, fen: string): Eval {
  const position = createChessPosition(fen);

  return {
    index: evaluation.index,
    depth: evaluation.depth,
    score: normalizeEvalScore(evaluation.score, turnFromFen(fen)),
    moves: evaluation.pv.map((pv) => {
      const from = pv.slice(0, 2);
      const to = pv.slice(2, 4);
      const promotion = pv.length > 4 ? (pv[4] ?? null) : null;
      const move = applyMove(position, {
        from,
        to,
        promotion,
      });

      return {
        from,
        to,
        promotion,
        san: move.san,
      };
    }),
  };
}

function turnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

function normalizeEvalScore(score: EngineEvalScore, turn: "white" | "black"): NormalizedEvalScore {
  switch (score.type) {
    case "cp":
      return { type: "cp", value: turn === "white" ? score.value : -score.value };
    case "mate-in":
      return { type: "mate-in", value: turn === "white" ? score.value : -score.value };
    case "mate":
      return { type: "mate", winner: turn === "white" ? "black" : "white" };
    case "stalemate":
      return score;
  }
}

export function updateEvaluation(
  state: MutableAppState,
  ctx: Context,
  engineEval: EngineEval,
): void {
  const fen = selectFen(state, ctx);
  if (engineEval.request.fen !== fen || engineEval.request.depth !== state.engineSettings.depth) {
    return;
  }

  let evaluation: Eval;

  try {
    evaluation = engineEvalToEval(engineEval, engineEval.request.fen);
  } catch {
    return;
  }

  const index = state.evaluations.findIndex((e) => e.index === engineEval.index);
  if (index === -1) {
    state.set("evaluations", [...state.evaluations, evaluation]);
  } else {
    state.set(
      "evaluations",
      state.evaluations.map((e, i) => (i === index ? evaluation : e)),
    );
  }
}

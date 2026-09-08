import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Engine, type EngineEval } from "@/lib/engine";
import { applyMove, createChessPosition } from "@/lib/chess";
import { EngineHost } from "./EngineHost";
import { EngineBridge } from "./engineBridge";
import { Button, styles } from "./ui";

export function Analysis({
  fen,
  play,
}: {
  fen: string;
  play(from: string, to: string, promotion: string): void;
}) {
  const [enabled, setEnabled] = useState(false);
  return (
    <View style={styles.card}>
      <Button active={enabled} onPress={() => setEnabled(!enabled)}>
        {enabled ? "Stop analysis" : "Analyze with Stockfish"}
      </Button>
      {enabled && <RunningAnalysis fen={fen} play={play} />}
    </View>
  );
}
function RunningAnalysis({
  fen,
  play,
}: {
  fen: string;
  play(from: string, to: string, promotion: string): void;
}) {
  const engine = useRef<Engine | null>(null);
  const bridge = useRef<EngineBridge | null>(null);
  const currentFen = useRef(fen);
  currentFen.current = fen;
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(14);
  const currentDepth = useRef(depth);
  currentDepth.current = depth;
  const register = useCallback((send: (command: string) => void) => {
    const adapter = new EngineBridge(send);
    bridge.current = adapter;
    const instance = new Engine(() => adapter);
    instance.onEvaluation((value) => {
      if (value.request.fen === currentFen.current) setEvaluation(value);
    });
    instance.setNumberOfLines(1);
    engine.current = instance;
    instance.evaluate(currentFen.current, currentDepth.current);
  }, []);
  const receive = useCallback((message: string) => bridge.current?.receive(message), []);
  const fail = useCallback((message: string) => setError(message), []);
  useEffect(() => {
    engine.current?.evaluate(fen, depth);
  }, [fen, depth]);
  useEffect(() => () => engine.current?.terminate(), []);
  const value = evaluation?.request.fen === fen ? evaluation : null;
  const white = createChessPosition(fen).turn === "w";
  const score = value?.score;
  const label =
    score?.type === "cp"
      ? `${((white ? score.value : -score.value) / 100).toFixed(2)}`
      : score?.type === "mate-in"
        ? `Mate in ${Math.abs(score.value)}`
        : "Evaluating…";
  const position = createChessPosition(fen);
  const line: string[] = [];
  for (const uci of value?.pv ?? []) {
    try {
      line.push(
        applyMove(position, {
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4] ?? null,
        }).san,
      );
    } catch {
      break;
    }
  }
  const best = value?.pv[0];
  return (
    <>
      <EngineHost register={register} receive={receive} fail={fail} />
      <Text style={styles.heading}>
        {error ?? `${label}${value === null ? "" : ` · depth ${value.depth}`}`}
      </Text>
      <Text style={styles.text}>{line.join(" ")}</Text>
      <View style={styles.row}>
        <Button onPress={() => setDepth(depth === 14 ? 20 : 14)}>Depth {depth}</Button>
        {best !== undefined && (
          <Button onPress={() => play(best.slice(0, 2), best.slice(2, 4), best[4] ?? "q")}>
            Play best move
          </Button>
        )}
      </View>
    </>
  );
}

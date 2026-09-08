import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { normalizePgn, STARTING_FEN } from "./gamePosition";
import type { StoredGame } from "@/lib/gameContracts";
import { Board } from "./Board";
import { Button, Field, styles } from "./ui";
import type { NativeService } from "./service";

export function Games({
  service,
  run,
}: {
  service: NativeService;
  run(action: () => void | Promise<void>): void;
}) {
  const [handle, setHandle] = useState("");
  const [color, setColor] = useState("all");
  const [timeControl, setTimeControl] = useState("all");
  const [selected, setSelected] = useState<StoredGame | null>(null);
  const [moveId, setMoveId] = useState<number | null>(null);
  const pgn = useMemo(() => (selected === null ? null : normalizePgn(selected.pgn)), [selected]);
  if (service.user === null)
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Games</Text>
        <Text style={styles.text}>Sign in from Account to import your Lichess games.</Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Games</Text>
      {selected === null ? (
        <>
          <View style={styles.card}>
            <Field label="Lichess username" value={handle} onChange={setHandle} />
            <View style={styles.row}>
              <Button
                disabled={handle.trim() === ""}
                onPress={() => run(() => service.importGames(handle.trim()))}
              >
                Import games
              </Button>
              <Button
                onPress={() =>
                  run(async () => {
                    await service.refreshImport();
                    await service.loadGames(color, timeControl);
                  })
                }
              >
                Refresh games
              </Button>
            </View>
            {service.importState !== null && (
              <Text style={styles.muted}>Import: {service.importState.status}</Text>
            )}
          </View>
          <Text style={styles.heading}>Color</Text>
          <View style={styles.row}>
            {["all", "white", "black"].map((value) => (
              <Button
                key={value}
                active={color === value}
                onPress={() => {
                  setColor(value);
                  run(() => service.loadGames(value, timeControl));
                }}
              >
                {value}
              </Button>
            ))}
          </View>
          <Text style={styles.heading}>Time control</Text>
          <View style={styles.row}>
            {["all", "bullet", "blitz", "rapid", "classical"].map((value) => (
              <Button
                key={value}
                active={timeControl === value}
                onPress={() => {
                  setTimeControl(value);
                  run(() => service.loadGames(color, value));
                }}
              >
                {value}
              </Button>
            ))}
          </View>
          {service.games.map((game) => (
            <View key={game.id} style={styles.card}>
              <Text style={styles.heading}>
                {game.whiteName} — {game.blackName}
              </Text>
              <Text style={styles.muted}>
                {game.result} · {game.speed} · {new Date(game.createdAt).toLocaleDateString()}
              </Text>
              {game.repertoireMistake !== null && (
                <Text style={styles.text}>
                  Repertoire mistake: {game.repertoireMistake.playedSan}; expected{" "}
                  {game.repertoireMistake.expectedSan}
                </Text>
              )}
              <Button
                onPress={() => {
                  setSelected(game);
                  setMoveId(null);
                }}
              >
                View game
              </Button>
            </View>
          ))}
        </>
      ) : (
        <>
          <Button onPress={() => setSelected(null)}>Back to games</Button>
          <Text style={styles.heading}>
            {selected.whiteName} — {selected.blackName}
          </Text>
          <Board
            fen={moveId === null ? STARTING_FEN : (pgn?.moves[moveId]?.fen ?? STARTING_FEN)}
            orientation={selected.userColor}
            onMove={() => {}}
            onMark={() => {}}
            disabled
          />
          <View style={styles.row}>
            <Button onPress={() => setMoveId(null)}>Start</Button>
            <Button
              onPress={() => setMoveId(moveId === null ? null : (pgn?.moves[moveId]?.prev ?? null))}
            >
              Previous
            </Button>
            <Button
              onPress={() =>
                setMoveId(
                  (moveId === null ? pgn?.rootMoveIds[0] : pgn?.moves[moveId]?.next[0]) ?? moveId,
                )
              }
            >
              Next
            </Button>
            <Button
              onPress={() => {
                service.model.createRepertoire(
                  selected.opening?.name ?? "Imported game",
                  selected.userColor,
                  selected.pgn,
                );
                setSelected(null);
              }}
            >
              Save as repertoire
            </Button>
          </View>
          <View style={styles.row}>
            {Object.values(pgn?.moves ?? {}).map((move) => (
              <Button key={move.id} active={move.id === moveId} onPress={() => setMoveId(move.id)}>
                {move.san}
              </Button>
            ))}
          </View>
          <Text style={styles.text}>{moveId === null ? "" : pgn?.moves[moveId]?.commentAfter}</Text>
        </>
      )}
    </ScrollView>
  );
}

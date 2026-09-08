import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "expo-crypto";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as chess from "@/lib/AppState";
import { persistence } from "./persistence";
import { NativeModel } from "./model";
import { NativeService } from "./service";
import { Api } from "./api";
import { Board } from "./Board";
import { Analysis } from "./Analysis";
import { Button, Dialog, Field, colors, styles } from "./ui";
import { Games } from "./Games";

const model = new NativeModel(persistence, randomUUID);
const service = new NativeService(model, new Api());
type Tab = "Library" | "Training" | "Games" | "Account";
type Editor = {
  kind:
    | "repertoire"
    | "chapter"
    | "rename-repertoire"
    | "rename-chapter"
    | "import"
    | "comment"
    | "delete-repertoire"
    | "delete-chapter";
  id: string;
  text: string;
};

export function App() {
  return (
    <SafeAreaProvider>
      <Workspace />
    </SafeAreaProvider>
  );
}
function Workspace() {
  useSyncExternalStore(model.subscribe, model.snapshot);
  const [initialized, setInitialized] = useState(false);
  const [tab, setTab] = useState<Tab>("Library");
  const [library, setLibrary] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [orientation, setOrientation] = useState<chess.Orientation>("white");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useEffect(() => {
    let active = true;
    const stopAutoSync = service.startAutoSync();
    void service
      .initialize()
      .catch((error: unknown) => model.report(error))
      .finally(() => {
        if (active) setInitialized(true);
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void service.refreshSession().catch((error: unknown) => model.report(error));
    });
    return () => {
      active = false;
      stopAutoSync();
      subscription.remove();
    };
  }, []);
  function run(action: () => void | Promise<void>) {
    if (busy) return;
    setBusy(true);
    model.error = null;
    void Promise.resolve()
      .then(action)
      .catch((error: unknown) => model.report(error))
      .finally(() => setBusy(false));
  }
  function edit(kind: Editor["kind"], id = "", text = "") {
    setEditor({ kind, id, text });
  }
  function saveEditor() {
    if (editor === null) return;
    run(() => {
      switch (editor.kind) {
        case "repertoire":
          model.createRepertoire(editor.text, orientation);
          setLibrary(false);
          break;
        case "chapter":
          model.createChapter(editor.id, editor.text);
          setLibrary(false);
          break;
        case "rename-repertoire":
          model.rename("repertoire", editor.id, editor.text);
          break;
        case "rename-chapter":
          model.rename("chapter", editor.id, editor.text);
          break;
        case "delete-repertoire":
          model.delete("repertoire", editor.id);
          break;
        case "delete-chapter":
          model.delete("chapter", editor.id);
          break;
        case "import":
          model.importPgn(editor.text);
          break;
        case "comment":
          model.command((state, ctx) =>
            chess.updateMoveCommentAfter(state, ctx, model.selected?.id ?? -1, editor.text),
          );
          break;
      }
      setEditor(null);
    });
  }
  async function importFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/x-chess-pgn", "text/plain", "application/octet-stream"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset === undefined) return;
    const pgn =
      asset.file === undefined ? await new File(asset.uri).text() : await asset.file.text();
    edit("import", "", pgn);
  }
  async function exportFile() {
    const pgn = model.exportPgn();
    if (await Sharing.isAvailableAsync()) {
      const file = new File(Paths.cache, "en-passant.pgn");
      file.write(pgn);
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/x-chess-pgn",
        dialogTitle: "Export PGN",
      });
    } else {
      await Clipboard.setStringAsync(pgn);
    }
  }
  if (!initialized)
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.text}>Loading your repertoire…</Text>
      </SafeAreaView>
    );
  const libraryContent = (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={[styles.heading, { flex: 1 }]}>Repertoires</Text>
        <Button onPress={() => edit("repertoire")}>New repertoire</Button>
      </View>
      {model.repertoires.length === 0 && (
        <Text style={styles.muted}>Create a repertoire to begin. Your library works offline.</Text>
      )}
      {model.repertoires.map((repertoire) => (
        <View key={repertoire.id} style={styles.card}>
          <Text style={styles.heading}>{repertoire.name}</Text>
          <Text style={styles.muted}>Playing as {repertoire.orientation}</Text>
          {model.chapters
            .filter((chapter) => chapter.repertoireId === repertoire.id)
            .map((chapter) => (
              <Button
                key={chapter.id}
                active={chapter.id === model.chapterId}
                onPress={() => {
                  model.openChapter(chapter.id);
                  setLibrary(false);
                }}
              >
                {chapter.name}
              </Button>
            ))}
          <View style={styles.row}>
            <Button onPress={() => edit("chapter", repertoire.id)}>New chapter</Button>
            <Button
              label={`Rename ${repertoire.name}`}
              onPress={() => edit("rename-repertoire", repertoire.id, repertoire.name)}
            >
              Rename
            </Button>
            <Button
              label={`Delete ${repertoire.name}`}
              onPress={() => edit("delete-repertoire", repertoire.id)}
            >
              Delete
            </Button>
          </View>
        </View>
      ))}
    </ScrollView>
  );
  const chapter = model.chapter;
  const attempt = model.attempt;
  const boardContent =
    chapter === null ? (
      <View style={styles.content}>
        <Text style={styles.muted}>Choose a chapter from your library.</Text>
      </View>
    ) : (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>{model.repertoire?.name}</Text>
            <Text style={styles.title}>{chapter.name}</Text>
          </View>
          <Button onPress={() => model.command((state) => chess.flipBoard(state))}>
            Flip board
          </Button>
        </View>
        <Board
          fen={model.fen}
          orientation={model.state.orientation}
          onMove={(from, to, promotion) => run(() => model.play(from, to, promotion))}
          onMark={(square) => {
            if (attempt === null)
              model.command((state, ctx) =>
                chess.toggleSquareOnSelectedMove(state, ctx, square, "normal"),
              );
          }}
          marked={Object.keys(chess.selectHighlights(model.state, model.context).squares)}
          disabled={attempt?.phase === "complete"}
        />
        {attempt !== null ? (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              {attempt.phase === "learn"
                ? "Learn this line"
                : attempt.phase === "complete"
                  ? "Line complete"
                  : "Recall this line"}
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {attempt.feedback}
            </Text>
            <Text style={styles.muted}>
              Move {Math.min(attempt.index + 1, attempt.moves.length)} of {attempt.moves.length} ·{" "}
              {attempt.mistakes} mistakes
            </Text>
            {attempt.phase === "learn" && (
              <Text style={styles.text}>Play {attempt.moves[attempt.index]?.san}</Text>
            )}
            <View style={styles.row}>
              <Button
                onPress={() => {
                  model.stopTraining();
                  setTab("Training");
                }}
              >
                Back to lines
              </Button>
              {attempt.phase === "complete" && (
                <Button onPress={() => model.startTraining(attempt.line, false)}>
                  Practice again
                </Button>
              )}
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.row, { justifyContent: "center" }]}>
              <Button label="First move" onPress={() => model.command(chess.moveToStart)}>
                ⏮
              </Button>
              <Button label="Previous move" onPress={() => model.command(chess.back)}>
                ←
              </Button>
              <Button label="Next move" onPress={() => model.command(chess.forward)}>
                →
              </Button>
              <Button label="Last move" onPress={() => model.command(chess.moveToLastMainLineMove)}>
                ⏭
              </Button>
            </View>
            <View style={styles.row}>
              <Button onPress={() => setTab("Training")}>Train chapter</Button>
              <Button onPress={() => edit("import")}>Import PGN</Button>
              <Button onPress={() => run(importFile)}>Open PGN file</Button>
              <Button onPress={() => run(exportFile)}>Export PGN</Button>
              <Button
                onPress={() =>
                  run(async () => {
                    await Clipboard.setStringAsync(model.exportPgn());
                  })
                }
              >
                Copy PGN
              </Button>
            </View>
            <Analysis
              fen={model.fen}
              play={(from, to, promotion) => run(() => model.play(from, to, promotion))}
            />
            <MoveList onComment={() => edit("comment", "", model.selected?.commentAfter ?? "")} />
            <View style={styles.row}>
              <Button onPress={() => edit("rename-chapter", chapter.id, chapter.name)}>
                Rename chapter
              </Button>
              <Button onPress={() => edit("delete-chapter", chapter.id)}>Delete chapter</Button>
            </View>
          </>
        )}
      </ScrollView>
    );
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.heading}>♞ En passant</Text>
        {busy || service.syncing ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.muted}>
            {service.user === null ? "On this device" : service.user.email}
          </Text>
        )}
      </View>
      {model.error !== null && (
        <View accessibilityRole="alert" style={[styles.card, { margin: 10 }]}>
          <Text selectable style={{ color: colors.danger }}>
            {model.error}
          </Text>
          <Button
            onPress={() => {
              model.error = null;
              model.notify();
            }}
          >
            Dismiss
          </Button>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {tab === "Library" && (
          <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
            {wide ? (
              <View style={{ width: 300, borderRightWidth: 1, borderColor: colors.border }}>
                {libraryContent}
              </View>
            ) : (
              <View style={{ padding: 10 }}>
                <Button onPress={() => setLibrary(!library)}>
                  {library ? "Open board" : "Choose repertoire"}
                </Button>
              </View>
            )}
            {!wide && library ? libraryContent : <View style={{ flex: 1 }}>{boardContent}</View>}
          </View>
        )}
        {tab === "Training" &&
          (attempt !== null ? (
            boardContent
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>Training</Text>
              <Text style={styles.muted}>
                {model.repertoire?.name} / {chapter?.name}
              </Text>
              <Button
                onPress={() => {
                  setTab("Library");
                  setLibrary(true);
                }}
              >
                Choose chapter
              </Button>
              {model.lines.length === 0 && (
                <Text style={styles.text}>Add moves to a chapter to start learning.</Text>
              )}
              {chess
                .prioritizeDueTrainingLines(
                  model.lines,
                  Object.fromEntries(model.lines.map((line) => [line.id, model.review(line)])),
                  Date.now(),
                )
                .map((line, index) => {
                  const review = model.review(line);
                  const due = chess.isTrainingReviewDue(review, Date.now());
                  return (
                    <View key={line.id} style={styles.card}>
                      <Text style={styles.heading}>
                        Line {index + 1}
                        {line.isAlternative ? " · Alternative" : ""}
                      </Text>
                      <Text style={styles.muted}>
                        {line.plyCount} plies ·{" "}
                        {review === undefined
                          ? "New"
                          : due
                            ? "Due now"
                            : `Review ${new Date(review.dueAt).toLocaleDateString()}`}{" "}
                        · {chess.trainingMasteryLevel(review?.intervalIndex)}
                      </Text>
                      <Text numberOfLines={2} style={styles.muted}>
                        {line.uciPath}
                      </Text>
                      <View style={styles.row}>
                        <Button onPress={() => model.startTraining(line, true)}>
                          Learn line {index + 1}
                        </Button>
                        <Button onPress={() => model.startTraining(line, false)}>
                          Train line {index + 1}
                        </Button>
                        <Button
                          onPress={() => {
                            model.command((state, ctx) =>
                              chess.selectMove(state, ctx, line.terminalMoveId),
                            );
                            setTab("Library");
                            setLibrary(false);
                          }}
                        >
                          View line {index + 1}
                        </Button>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          ))}
        {tab === "Games" && <Games service={service} run={run} />}
        {tab === "Account" && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Account</Text>
            {service.user === null ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Sync your repertoire</Text>
                <Text style={styles.muted}>
                  Sign in with an email code to use your En Passant library across devices.
                </Text>
                <Field label="Email" value={email} onChange={setEmail} />
                {sentCode && <Field label="Verification code" value={code} onChange={setCode} />}
                <Button
                  disabled={busy || email.trim() === ""}
                  onPress={() =>
                    run(async () => {
                      if (sentCode) await service.signIn(email.trim(), code.trim());
                      else {
                        await service.sendCode(email.trim());
                        setSentCode(true);
                      }
                    })
                  }
                >
                  {sentCode ? "Verify code" : "Send code"}
                </Button>
                {sentCode && <Button onPress={() => setSentCode(false)}>Use another email</Button>}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.heading}>{service.user.name}</Text>
                <Text style={styles.text}>{service.user.email}</Text>
                <Button disabled={service.syncing} onPress={() => run(() => service.sync())}>
                  Sync now
                </Button>
                <Button onPress={() => run(() => service.signOut())}>Sign out</Button>
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.heading}>En passant</Text>
              <Text style={styles.text}>Build and train your chess repertoire.</Text>
              <Text style={styles.muted}>
                Your library is saved on this device. Export a PGN to share your work.
              </Text>
              <Text style={styles.muted}>
                GPL-3.0-or-later · Chess artwork: Cburnett, GPL-2.0-or-later
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
      <View
        style={[
          styles.row,
          {
            borderTopWidth: 1,
            borderColor: colors.border,
            padding: 8,
            justifyContent: "space-around",
          },
        ]}
      >
        {(["Library", "Training", "Games", "Account"] as const).map((item) => (
          <Button
            key={item}
            active={tab === item}
            onPress={() => {
              if (tab !== item) model.stopTraining();
              setTab(item);
            }}
          >
            {item}
          </Button>
        ))}
      </View>
      {editor !== null && (
        <Dialog
          title={
            editor.kind.startsWith("delete")
              ? "Delete permanently?"
              : editor.kind === "import"
                ? "Import PGN"
                : editor.kind === "comment"
                  ? "Edit comment"
                  : editor.kind.includes("rename")
                    ? "Rename"
                    : editor.kind === "chapter"
                      ? "New chapter"
                      : "New repertoire"
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind.startsWith("delete") ? (
            <Text style={styles.text}>
              This removes the{" "}
              {editor.kind === "delete-chapter"
                ? "chapter and its moves"
                : "repertoire and all its chapters"}{" "}
              from your library and synced devices.
            </Text>
          ) : (
            <Field
              label={
                editor.kind === "import" ? "PGN" : editor.kind === "comment" ? "Comment" : "Name"
              }
              value={editor.text}
              onChange={(text) => setEditor({ ...editor, text })}
              multiline={editor.kind === "import" || editor.kind === "comment"}
            />
          )}
          {editor.kind === "repertoire" && (
            <View style={styles.row}>
              <Button active={orientation === "white"} onPress={() => setOrientation("white")}>
                White
              </Button>
              <Button active={orientation === "black"} onPress={() => setOrientation("black")}>
                Black
              </Button>
            </View>
          )}
          <Button disabled={busy} onPress={saveEditor}>
            {editor.kind.startsWith("delete") ? "Confirm delete" : "Save"}
          </Button>
        </Dialog>
      )}
    </SafeAreaView>
  );
}
function MoveList({ onComment }: { onComment(): void }) {
  const pgn = model.pgn;
  if (pgn === null) return null;
  const rows: { move: chess.Move; depth: number }[] = [];
  function visit(ids: number[], depth: number) {
    for (const [index, id] of ids.entries()) {
      const move = pgn?.moves[id];
      if (move === undefined) continue;
      rows.push({ move, depth: depth + (index > 0 ? 1 : 0) });
      visit(move.next, depth + (index > 0 ? 1 : 0));
    }
  }
  visit(pgn.rootMoveIds, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Moves</Text>
      {rows.length === 0 && (
        <Text style={styles.muted}>Tap a piece, then its destination to add a move.</Text>
      )}
      <View style={styles.row}>
        {rows.map(({ move, depth }) => (
          <View key={move.id} style={{ marginLeft: depth * 8 }}>
            <Button
              active={model.selected?.id === move.id}
              onPress={() => model.command((state, ctx) => chess.selectMove(state, ctx, move.id))}
            >{`${chess.getMoveNumber(move)}${chess.isMoveWhite(move) ? "." : "…"} ${move.san}${move.nags.map(chess.getNagGlyph).join("")}`}</Button>
          </View>
        ))}
      </View>
      {model.selected !== null && (
        <>
          <Text style={styles.text}>{model.selected.commentBefore}</Text>
          <Text style={styles.text}>{model.selected.commentAfter}</Text>
          <View style={styles.row}>
            <Button onPress={onComment}>Edit comment</Button>
            {[1, 2, 3, 4, 5, 6].map((nag) => (
              <Button
                key={nag}
                label={`Annotation ${chess.getNagMeaning(nag)}`}
                active={model.selected?.nags.includes(nag)}
                onPress={() =>
                  model.command((state, ctx) => chess.setNagOnSelectedMove(state, ctx, nag))
                }
              >
                {chess.getNagGlyph(nag)}
              </Button>
            ))}
            <Button
              onPress={() => {
                const move = model.selected;
                if (move !== null)
                  model.command((state, ctx) => chess.promoteVariation(state, ctx, move.id));
              }}
            >
              Promote variation
            </Button>
            <Button
              onPress={() => {
                const move = model.selected;
                if (move !== null)
                  model.command((state, ctx) => chess.deleteMove(state, ctx, move.id));
              }}
            >
              Delete move
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

import { afterEach, describe, expect, test, vi } from "vitest";
import { Engine, parseStockfishMessage, type EngineWorker } from "./engine";

type MessageListener = (event: MessageEvent<unknown>) => void;
type ErrorListener = (event: ErrorEvent) => void;

class FakeWorker implements EngineWorker {
  readonly messages: string[] = [];

  terminated = false;

  private readonly messageListeners: MessageListener[] = [];

  private readonly errorListeners: ErrorListener[] = [];

  private readonly messageErrorListeners: MessageListener[] = [];

  postMessage(message: string): void {
    this.messages.push(message);
  }

  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  addEventListener(type: "messageerror", listener: MessageListener): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: MessageListener | ErrorListener,
  ): void {
    if (type === "message") {
      this.messageListeners.push(listener as MessageListener);
    } else if (type === "error") {
      this.errorListeners.push(listener as ErrorListener);
    } else {
      this.messageErrorListeners.push(listener as MessageListener);
    }
  }

  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "messageerror", listener: MessageListener): void;
  removeEventListener(
    type: "message" | "error" | "messageerror",
    listener: MessageListener | ErrorListener,
  ): void {
    if (type === "message") {
      removeListener(this.messageListeners, listener as MessageListener);
    } else if (type === "error") {
      removeListener(this.errorListeners, listener as ErrorListener);
    } else {
      removeListener(this.messageErrorListeners, listener as MessageListener);
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: string): void {
    const event = { data } as MessageEvent<unknown>;
    this.messageListeners.forEach((listener) => listener(event));
  }

  emitError(error: unknown = null): void {
    const event = { error } as ErrorEvent;
    this.errorListeners.forEach((listener) => listener(event));
  }
}

function removeListener<T>(listeners: T[], listener: T): void {
  const index = listeners.indexOf(listener);
  if (index !== -1) {
    listeners.splice(index, 1);
  }
}

function createEngine() {
  const workers: FakeWorker[] = [];
  const engine = new Engine(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { engine, workers };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Engine", () => {
  test("starts an evaluation immediately when the engine is idle", () => {
    const { engine, workers } = createEngine();

    engine.evaluate("fen-a", 12);

    expect(workers[0]?.messages).toEqual(["position fen fen-a", "go depth 12"]);
  });

  test("coalesces rapid evaluations until the active search stops", () => {
    const { engine, workers } = createEngine();
    const worker = workers[0];

    engine.evaluate("fen-a", 12);
    engine.evaluate("fen-b", 12);
    engine.evaluate("fen-c", 14);

    expect(worker?.messages).toEqual(["position fen fen-a", "go depth 12", "stop"]);

    worker?.emitMessage("bestmove e2e4");

    expect(worker?.messages).toEqual([
      "position fen fen-a",
      "go depth 12",
      "stop",
      "position fen fen-c",
      "go depth 14",
    ]);
  });

  test("waits for the active search to stop before applying line-count changes", () => {
    const { engine, workers } = createEngine();
    const worker = workers[0];

    engine.evaluate("fen-a", 12);
    engine.setNumberOfLines(3);
    engine.evaluate("fen-b", 12);

    expect(worker?.messages).toEqual(["position fen fen-a", "go depth 12", "stop"]);

    worker?.emitMessage("bestmove e2e4");

    expect(worker?.messages).toEqual([
      "position fen fen-a",
      "go depth 12",
      "stop",
      "setoption name MultiPV value 3",
      "position fen fen-b",
      "go depth 12",
    ]);
  });

  test("restarts a trapped worker and retries the active request once", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { engine, workers } = createEngine();

    engine.evaluate("fen-a", 12);
    workers[0]?.emitError();

    expect(workers[0]?.terminated).toBe(true);
    expect(workers[1]?.messages).toEqual(["position fen fen-a", "go depth 12"]);

    workers[1]?.emitError();

    expect(workers[1]?.terminated).toBe(true);
    expect(workers[2]?.messages).toEqual([]);
  });
});

describe("parseStockfishMessage", () => {
  test("parses principal variations without relying on fixed token offsets", () => {
    expect(
      parseStockfishMessage(
        "info depth 20 seldepth 27 multipv 2 score cp -19 nodes 358804 nps 579651 hashfull 139 time 619 pv e7e6 d2d4",
      ),
    ).toEqual({
      depth: 20,
      index: 1,
      score: { type: "cp", value: -19 },
      pv: ["e7e6", "d2d4"],
    });
  });

  test("parses bound messages by locating the pv token", () => {
    expect(
      parseStockfishMessage(
        "info depth 17 seldepth 24 multipv 1 score cp 28 upperbound nodes 232551 nps 292149 hashfull 92 time 796 pv e2e4 c7c5",
      ),
    ).toEqual({
      depth: 17,
      index: 0,
      score: { type: "cp", value: 28 },
      pv: ["e2e4", "c7c5"],
    });
  });

  test("parses mate scores in principal variations", () => {
    expect(parseStockfishMessage("info depth 12 score mate -3 pv h2h4 e7e5")).toEqual({
      depth: 12,
      index: 0,
      score: { type: "mate-in", value: -3 },
      pv: ["h2h4", "e7e5"],
    });
  });

  test("preserves mate and stalemate terminal messages without pv lines", () => {
    expect(parseStockfishMessage("info depth 1 score cp 0")).toEqual({
      depth: 1,
      index: 0,
      score: { type: "stalemate" },
      pv: [],
    });
    expect(parseStockfishMessage("info depth 1 score mate 0")).toEqual({
      depth: 1,
      index: 0,
      score: { type: "mate" },
      pv: [],
    });
  });
});

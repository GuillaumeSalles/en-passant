const STOCKFISH_WORKER_PATH = "/stockfish-18-lite-single.js";

export type EngineWorker = {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  addEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  removeEventListener(type: "messageerror", listener: (event: MessageEvent<unknown>) => void): void;
  terminate(): void;
};

export type EngineWorkerFactory = () => EngineWorker;

export class Engine {
  private worker: EngineWorker;

  private onEvaluationCallbacks: ((evaluation: EngineEval) => void)[] = [];

  private currentRequest: EngineRequest | null = null;

  private pendingRequest: EngineRequest | null = null;

  private pendingNumberOfLines: number | null = null;

  private isSearching = false;

  private isWaitingForStop = false;

  private isTerminated = false;

  private lastCrashedRequest: EngineRequest | null = null;

  constructor(
    private readonly workerFactory: EngineWorkerFactory = () => new Worker(STOCKFISH_WORKER_PATH),
  ) {
    this.worker = this.createWorker();
  }

  private createWorker(): EngineWorker {
    const worker = this.workerFactory();
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onError);
    worker.addEventListener("messageerror", this.onMessageError);
    return worker;
  }

  private onMessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== "string") return;

    if (isBestMoveMessage(event.data)) {
      this.finishSearch();
      return;
    }

    const evaluation = parseStockfishMessage(event.data);
    const request = this.currentRequest;
    if (evaluation !== null && request !== null) {
      this.onEvaluationCallbacks.forEach((callback) => callback({ ...evaluation, request }));
    }
  };

  private onError = (event: ErrorEvent) => {
    console.error("Stockfish error", event.error);
    this.restartWorker();
  };

  private onMessageError = (event: MessageEvent<unknown>) => {
    console.error("Stockfish message error", event);
    this.restartWorker();
  };

  onEvaluation(callback: (evaluation: EngineEval) => void) {
    this.onEvaluationCallbacks.push(callback);
  }

  setNumberOfLines(numberOfLines: number) {
    this.pendingNumberOfLines = numberOfLines;
    if (this.isSearching) {
      this.stopCurrentSearch();
      return;
    }
    this.flushPendingCommands();
  }

  evaluate(currentFen: string, depth: number) {
    const request = { fen: currentFen, depth };
    this.pendingRequest = request;
    if (!isSameRequest(request, this.lastCrashedRequest)) {
      this.lastCrashedRequest = null;
    }

    if (this.isSearching) {
      this.stopCurrentSearch();
      return;
    }
    this.flushPendingCommands();
  }

  terminate() {
    this.isTerminated = true;
    this.onEvaluationCallbacks = [];
    this.removeWorkerListeners(this.worker);
    this.worker.terminate();
  }

  private stopCurrentSearch() {
    if (this.isWaitingForStop) return;
    this.worker.postMessage("stop");
    this.isWaitingForStop = true;
  }

  private finishSearch() {
    this.isSearching = false;
    this.isWaitingForStop = false;
    this.currentRequest = null;
    this.flushPendingCommands();
  }

  private flushPendingCommands() {
    if (this.isTerminated || this.isSearching || this.isWaitingForStop) return;

    const numberOfLines = this.pendingNumberOfLines;
    if (numberOfLines !== null) {
      this.pendingNumberOfLines = null;
      this.worker.postMessage(`setoption name MultiPV value ${numberOfLines}`);
    }

    const request = this.pendingRequest;
    if (request === null) return;

    this.pendingRequest = null;
    this.currentRequest = request;
    this.isSearching = true;
    this.worker.postMessage(`position fen ${request.fen}`);
    this.worker.postMessage(`go depth ${request.depth}`);
  }

  private restartWorker() {
    if (this.isTerminated) return;

    const failedRequest = this.currentRequest;
    const shouldRetryFailedRequest =
      failedRequest !== null && !isSameRequest(failedRequest, this.lastCrashedRequest);
    const requestToRun = this.pendingRequest ?? (shouldRetryFailedRequest ? failedRequest : null);
    if (failedRequest !== null) {
      this.lastCrashedRequest = failedRequest;
    }

    this.removeWorkerListeners(this.worker);
    this.worker.terminate();
    this.worker = this.createWorker();
    this.currentRequest = null;
    this.pendingRequest = requestToRun;
    this.isSearching = false;
    this.isWaitingForStop = false;
    this.flushPendingCommands();
  }

  private removeWorkerListeners(worker: EngineWorker) {
    worker.removeEventListener("message", this.onMessage);
    worker.removeEventListener("error", this.onError);
    worker.removeEventListener("messageerror", this.onMessageError);
  }
}

export type BestMoveMessage = {
  type: "bestmove";
  bestMove: string;
  ponder: string;
};

export type EvalScore =
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
    }
  | {
      type: "stalemate";
    };

export type EngineRequest = {
  fen: string;
  depth: number;
};

export type EngineEval = ParsedEngineEval & {
  request: EngineRequest;
};

export type ParsedEngineEval = {
  index: number;
  depth: number;
  score: EvalScore;
  pv: string[];
};

function isBestMoveMessage(message: string): boolean {
  return message.startsWith("bestmove ");
}

function isSameRequest(a: EngineRequest | null, b: EngineRequest | null): boolean {
  return a?.fen === b?.fen && a?.depth === b?.depth;
}

export function parseStockfishMessage(message: string): ParsedEngineEval | null {
  const tokens = message.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;

  const depth = numberAfter(tokens, "depth");
  if (depth === null) return null;

  const scoreIndex = tokens.indexOf("score");
  if (scoreIndex === -1) return null;

  const scoreKind = tokens[scoreIndex + 1];
  const scoreValue = parseNumber(tokens[scoreIndex + 2]);
  if ((scoreKind !== "cp" && scoreKind !== "mate") || scoreValue === null) return null;

  const pvIndex = tokens.indexOf("pv");
  if (pvIndex === -1) {
    if (scoreKind === "cp" && scoreValue === 0) {
      return {
        index: 0,
        depth,
        score: { type: "stalemate" },
        pv: [],
      };
    }

    if (scoreKind === "mate" && scoreValue === 0) {
      return {
        index: 0,
        depth,
        score: { type: "mate" },
        pv: [],
      };
    }

    return null;
  }

  return {
    depth,
    index: (numberAfter(tokens, "multipv") ?? 1) - 1,
    score:
      scoreKind === "cp"
        ? {
            type: "cp",
            value: scoreValue,
          }
        : {
            type: "mate-in",
            value: scoreValue,
          },
    pv: tokens.slice(pvIndex + 1),
  };
}

function numberAfter(tokens: string[], token: string): number | null {
  return parseNumber(tokens[tokens.indexOf(token) + 1]);
}

function parseNumber(token: string | undefined): number | null {
  if (token === undefined) return null;
  const value = Number.parseInt(token, 10);
  return Number.isNaN(value) ? null : value;
}

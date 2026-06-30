import { describe, expect, test, vi } from "vitest";
import { createLatestPgnSaveQueue } from "./pgnSaveQueue";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createLatestPgnSaveQueue", () => {
  test("serializes writes and keeps only the latest pending PGN per id", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const writes: { id: string; pgn: string }[] = [];
    const afterWrite = vi.fn();
    const writePgn = vi.fn((id: string, pgn: string) => {
      writes.push({ id, pgn });
      return writes.length === 1 ? firstWrite.promise : secondWrite.promise;
    });
    const queue = createLatestPgnSaveQueue(writePgn, afterWrite);

    const idle = queue.saveLatestPgn("chapter-pgn", "1. e4 *");
    queue.saveLatestPgn("chapter-pgn", "1. e4 e5 *");
    queue.saveLatestPgn("chapter-pgn", "1. e4 e5 2. Nf3 *");

    expect(writes).toEqual([{ id: "chapter-pgn", pgn: "1. e4 *" }]);

    firstWrite.resolve();
    await flushMicrotasks();

    expect(writes).toEqual([
      { id: "chapter-pgn", pgn: "1. e4 *" },
      { id: "chapter-pgn", pgn: "1. e4 e5 2. Nf3 *" },
    ]);

    secondWrite.resolve();
    await idle;

    expect(afterWrite).toHaveBeenCalledTimes(2);
  });

  test("keeps draining newer writes after a failed write", async () => {
    const secondWrite = deferred<void>();
    const writes: { id: string; pgn: string }[] = [];
    const afterWrite = vi.fn();
    const writePgn = vi.fn((id: string, pgn: string) => {
      writes.push({ id, pgn });
      if (writes.length === 1) {
        return Promise.reject(new Error("IndexedDB failed"));
      }
      return secondWrite.promise;
    });
    const queue = createLatestPgnSaveQueue(writePgn, afterWrite);

    const idle = queue.saveLatestPgn("chapter-pgn", "1. d4 *");
    queue.saveLatestPgn("chapter-pgn", "1. d4 d5 *");

    await flushMicrotasks();

    expect(writes).toEqual([
      { id: "chapter-pgn", pgn: "1. d4 *" },
      { id: "chapter-pgn", pgn: "1. d4 d5 *" },
    ]);

    secondWrite.resolve();
    await idle;

    expect(afterWrite).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, test, vi } from "vitest";
import type { PgnMutation } from "@/lib/AppState";
import { createPgnMutationSaveQueue } from "./pgnSaveQueue";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const e4: PgnMutation = {
  type: "addMove",
  parentPath: [],
  move: "e2e4",
  annotations: { nags: [], commentBefore: null, commentAfter: null },
};
const e5: PgnMutation = {
  type: "addMove",
  parentPath: ["e2e4"],
  move: "e7e5",
  annotations: { nags: [], commentBefore: null, commentAfter: null },
};
const nf3: PgnMutation = {
  type: "addMove",
  parentPath: ["e2e4", "e7e5"],
  move: "g1f3",
  annotations: { nags: [], commentBefore: null, commentAfter: null },
};

describe("createPgnMutationSaveQueue", () => {
  test("serializes writes without dropping mutations", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const writes: { pgn: string; mutations: PgnMutation[] }[] = [];
    const afterWrite = vi.fn();
    const writePgn = vi.fn((_id: string, pgn: string, mutations: PgnMutation[]) => {
      writes.push({ pgn, mutations });
      return writes.length === 1 ? firstWrite.promise : secondWrite.promise;
    });
    const queue = createPgnMutationSaveQueue(writePgn, afterWrite);

    const idle = queue.savePgnMutation("chapter-pgn", "1. e4 *", e4);
    queue.savePgnMutation("chapter-pgn", "1. e4 e5 *", e5);
    queue.savePgnMutation("chapter-pgn", "1. e4 e5 2. Nf3 *", nf3);

    expect(writes).toEqual([{ pgn: "1. e4 *", mutations: [e4] }]);

    firstWrite.resolve();
    await flushMicrotasks();

    expect(writes).toEqual([
      { pgn: "1. e4 *", mutations: [e4] },
      { pgn: "1. e4 e5 2. Nf3 *", mutations: [e5, nf3] },
    ]);

    secondWrite.resolve();
    await idle;
    expect(afterWrite).toHaveBeenCalledTimes(2);
  });

  test("does not acknowledge or discard a failed mutation batch", async () => {
    const writePgn = vi
      .fn<(_id: string, _pgn: string, _mutations: PgnMutation[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error("IndexedDB failed"))
      .mockResolvedValueOnce();
    const afterWrite = vi.fn();
    const queue = createPgnMutationSaveQueue(writePgn, afterWrite);

    await queue.savePgnMutation("chapter-pgn", "1. e4 *", e4);
    await queue.savePgnMutation("chapter-pgn", "1. e4 e5 *", e5);

    expect(writePgn).toHaveBeenNthCalledWith(1, "chapter-pgn", "1. e4 *", [e4]);
    expect(writePgn).toHaveBeenNthCalledWith(2, "chapter-pgn", "1. e4 e5 *", [e4, e5]);
    expect(afterWrite).toHaveBeenCalledTimes(1);
  });
});
